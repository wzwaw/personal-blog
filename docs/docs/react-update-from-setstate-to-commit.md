# React 更新到底发生了什么：从 setState 到 Commit

当我们调用 `setState` 或 Hook 的 `dispatch` 时，React 并不是立即重建整棵树、做一次全量 diff，再把旧树整体替换掉。

更准确的理解是：React 从当前 Fiber 树出发，构建一棵可复用的 `workInProgress` 树；在构建过程中逐层执行组件、协调子节点并记录变更，最后在 commit 阶段把这些变更应用到页面。

> 本文以 React 18 之后的 Fiber 心智模型为背景。Fiber 字段、标记名称与执行细节属于内部实现，可能随版本变化。

## 两棵 Fiber 树，而不是每次从零开始

React 内部可以理解为同时维护两棵树：

- `current`：已经提交、对应当前页面的 Fiber 树
- `workInProgress`：本次更新正在构建的 Fiber 树

两棵树中的对应 Fiber 通过 `alternate` 互相引用：

```text
current Fiber <---- alternate ----> workInProgress Fiber
```

更新开始时，如果某个 Fiber 已经有 `alternate`，React 会复用它；只有没有可复用对象时才创建新的 Fiber。因此，“根据新的 state 和 props 构建 workInProgress 树”比“创建一棵全新的树”更准确。

这也解释了 reconcile 时 React 如何找到旧节点。处理某个 `workInProgress` Fiber 时，它可以通过 `alternate` 找到对应的 `current` Fiber，再从 `current.child` 取得旧的子 Fiber 链表。

## 一次更新的完整路径

以一个计数器为例：

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(value => value + 1)}>
      {count}
    </button>
  );
}
```

点击按钮后，大致会经历以下过程。

### 1. 创建更新并分配优先级

`setCount` 不会直接修改 DOM。React 会先创建 update，将它放进对应 Fiber 的更新队列，并为它分配 lane。

lane 用来表达更新的优先级和批次。例如，用户输入通常比 transition 或空闲任务更紧急。调度器会结合 lane 判断：

- 什么时候开始处理更新
- 多个更新能否合并
- render 是否可以被更高优先级任务中断

可以把入口流程简化为：

```text
setState / dispatch
  → 创建 update
  → 写入 updateQueue
  → 计算 lane
  → scheduleUpdateOnFiber
```

### 2. 在 render 阶段边执行、边 reconcile

React 从 root 开始创建或复用 `workInProgress` Fiber，然后通过 `beginWork` 向下遍历。

处理函数组件时，React 会执行组件函数，得到新的 React Element：

```text
beginWork(current, workInProgress, renderLanes)
  → 执行组件，得到 nextChildren
  → reconcileChildren(...)
```

reconcile 并不是等新树完整生成后，再和旧树整体比较。它发生在 `workInProgress` 树的构建过程中：

```text
新的子节点：nextChildren
旧的子 Fiber：current.child
```

React 会根据元素的 `type`、`key` 和位置等信息，逐个判断应该复用、创建、移动还是删除 Fiber，并继续处理它的 `child` 与 `sibling`。

这就是“边 render，边 diff”的含义。

### 3. completeWork 向上收集结果

子节点处理完成后，React 通过 `completeWork` 向上返回，准备宿主环境所需的变更，并在 Fiber 上记录 flags。

常见变更包括：

- `Placement`：插入或移动节点
- `Update`：更新节点
- 删除相关标记：移除节点
- `Passive`：存在需要处理的 `useEffect`
- `Layout`：存在需要同步处理的布局副作用

旧版 React 常用“副作用链表”解释这一过程。现代实现更适合描述为：render 阶段在 Fiber 上设置 `flags` 和 `subtreeFlags`，commit 阶段再根据这些标记遍历并执行变更。

render 阶段只是在计算“页面应该变成什么样”，不会直接完成可见的 DOM 更新。

## Commit 阶段如何落地变更

当 `workInProgress` 树完成后，它会成为 `finishedWork`，随后进入 commit 阶段。

commit 大致包含这些步骤：

1. **before mutation**：DOM 变化前读取快照，例如 class 组件的 `getSnapshotBeforeUpdate`
2. **mutation**：执行 DOM 插入、更新和删除
3. **切换 current**：让 `root.current` 指向 `finishedWork`
4. **layout**：同步执行 `useLayoutEffect` 和相关 class 生命周期
5. **passive effects**：另行调度 `useEffect`

指针切换可以简化为：

```js
root.current = finishedWork;
```

所以“新树替换旧树”并不是把旧对象全部删除后再复制一棵树，而是切换 root 的 `current` 指针。旧的 `current` 仍可通过 `alternate` 在下一次更新中复用。

这里还有一个关键区别：

- render 阶段可以被中断、重启，尚未提交的结果也可以被放弃
- commit 阶段一旦开始，就会同步完成，不能留下只更新了一半的页面

## Hook 重新调用，不代表所有工作重新执行

函数组件更新时，组件函数和其中的 Hook 确实会再次按顺序调用。但“调用 Hook”不等于“所有昂贵工作与副作用都会重跑”：

- `useState` 主要读取对应 Hook 节点的状态
- `useMemo` 在依赖未变时返回缓存结果
- `useCallback` 在依赖未变时返回原函数引用
- `useEffect` 会登记并比较依赖，依赖未变时不会重新执行 effect

函数调用通常不是渲染中最昂贵的部分。更需要关注的是复杂计算、大列表、重复的子组件渲染、DOM 操作，以及 effect 中的网络请求或订阅。

这也是 Hooks 的主要价值并非“减少函数执行”的原因。它解决的是状态逻辑的组织与复用问题：相关的 setup 和 cleanup 可以放在同一个 effect 中，通用逻辑也可以抽成自定义 Hook，而不必依赖 HOC、render props 或分散的 class 生命周期。

## 最后串起来

一次 React 更新可以压缩成这条主线：

```text
setState / dispatch
  → 创建 update，分配 lane
  → 调度更新
  → 构建 workInProgress
  → 执行组件并逐层 reconcile
  → 在 Fiber 上记录 flags
  → commit DOM 变更与布局副作用
  → 切换 root.current
  → 调度 passive effects
```

理解这条链路后，很多容易混淆的问题会自然清晰：

- React 复用 Fiber，而不是每次从零创建全部对象
- diff 发生在构建 `workInProgress` 的过程中，而不是两棵完整树之间的一次性比较
- render 负责计算和标记，commit 负责真正修改页面
- “新树替换旧树”的本质是 current 指针切换
- Hooks 重新调用不等于副作用和昂贵计算全部重跑

这套模型比“生成新树 → 全量 diff → 执行副作用队列”更接近现代 React 的实际工作方式。
