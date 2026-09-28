# Hooks 每次都重新执行，贵的不是这次调用

[从 setState 到 commit](/docs/react-update-from-setstate-to-commit) 讲的是一次更新如何被调度、协调和提交。这篇只回答随后那个疑问：函数组件每次更新都把 Hook 再调用一遍，是不是浪费？

不是。Hooks 要解决的是状态逻辑如何组织和复用。重新调用 Hook 函数，通常只是沿着 Fiber 上的链表读状态、比较依赖、返回缓存。

## class 和函数组件共用同一次更新

两条路径在 Fiber 上的调度是一样的：render 得到 children，reconcile 生成 `workInProgress`，commit 落地 DOM 和副作用。

保存状态的位置不同：

```text
class：Fiber → 组件实例 → this.state / 生命周期 / render()
函数：Fiber → memoizedState 上的 Hook 链表 → 函数(props) → effect
```

class 的状态在实例上，更新队列也在实例上。函数组件没有实例，第 n 次调用的 Hook 对应链表上的第 n 个节点，所以 Hook 不能放进条件里，调用顺序必须稳定。

## 调用 Hook，不等于重做里面的工作

```tsx
function Page() {
  const [count, setCount] = useState(0)
  const data = useMemo(() => expensiveCompute(count), [count])

  useEffect(() => {
    fetchData()
  }, [])

  return <div>{count}</div>
}
```

每次渲染都会按顺序执行 `useState`、`useMemo` 和 `useEffect`，但：

- `useState` 读取当前 Hook 节点里的状态
- `useMemo` 在依赖没变时返回上次的值
- `useEffect` 比较依赖，没变就不会重新执行 effect
- `useCallback` 在依赖没变时返回原来的函数

“Hook 函数被调用”是真的。“副作用和重计算都重新跑了”不是。

## 它替换的是被拆散的生命周期

class 里一段订阅通常要分成三处：

```tsx
componentDidMount() {
  subscribe(this.props.id)
}

componentDidUpdate(prevProps) {
  if (prevProps.id !== this.props.id) {
    unsubscribe(prevProps.id)
    subscribe(this.props.id)
  }
}

componentWillUnmount() {
  unsubscribe(this.props.id)
}
```

Hook 把建立和清理放回同一段逻辑，也可以直接变成可复用函数：

```tsx
function useSubscription(id: string) {
  useEffect(() => {
    subscribe(id)
    return () => unsubscribe(id)
  }, [id])
}
```

class 时代复用这段逻辑，常见办法是 HOC、render props 或 mixin。它们会多一层组件、让数据来源变模糊，也把同一件事拆进多个生命周期。自定义 Hook 复用的是状态逻辑，不增加渲染层级。

函数组件因此更接近 `UI = f(state, props)`。状态和副作用从 Hook 接入，组件本身仍然是一次函数执行。这也更适合后续的并发渲染：渲染可以被打断和重做，组件不能把一次执行当成只会发生一次的实例方法。

## 真正贵的部分要单独拦住

无依赖的重计算不会因为用了 Hook 就变便宜：

```tsx
function BigList({ list }: { list: Item[] }) {
  const result = heavyCompute(list)
  return <div>{result}</div>
}
```

这里每次渲染都在算。应该放进 `useMemo`，或把计算移出渲染。同样，渲染期间新建的数组、对象和函数传给子组件，会让子组件觉得 props 变了。能放在组件外的常量就不要每次创建；必须留在组件里、又要保持引用稳定时，再用 `useMemo` 或 `useCallback`。

React 选择的模型是：允许重新执行组件函数，再用 `memo`、依赖缓存、并发优先级和 commit 阶段的 DOM diff 控制昂贵部分。函数调用本身通常便宜。贵的是大量 DOM 操作、大列表、复杂计算，以及 effect 里的请求、订阅和 DOM 读写。
