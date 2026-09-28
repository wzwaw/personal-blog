# Vue 3：watch、computed 和响应式到底在监听什么

Vue 3 的响应式经常被说成“数据一变，视图就变”。这句话描述的是结果。源码层面更准确的说法是：读取时收集依赖，写入时通知依赖，渲染函数只是众多 effect 中的一种。

## watch 为什么经常写成 getter

`watch` 的第一个参数是数据源，第二个参数是变化后的回调。数据源可以是一个 `ref`，也可以是返回要监听内容的 getter。

一次要同时盯住弹窗开关、筛选条件和排除项时，getter 比多个 `watch` 更合适：

```ts
watch(
  () => [props.visible, props.source, props.strategy, props.excludeId] as const,
  ([open]) => {
    if (!open) return
    selection.value = undefined
    fetchOptions()
  }
)
```

这里有三个容易混在一起的点。

getter 每次执行都会重新返回一个数组。数组里任意一项变了，`watch` 就会认为数据源变了。如果只写 `watch(props.visible, ...)`，就只能监听一个来源。

`as const` 是 TypeScript 的常量断言，不是运行时转换。它让这个数组被推断成固定元组，回调里解构出来的类型更精确。它和 `as SomeType` 那种覆盖类型的断言不是一回事。

回调的第一个参数是数据源的新值。这里的数据源是数组，所以 `([open])` 只是取出第 0 项。`open` 就是当前的 `props.visible`。弹窗关闭时直接返回，避免发一次无效请求。

## computed 是依赖，也是 effect

`computed(() => ...)` 返回的是 `ComputedRef`。它自己处在响应式链条里，但不会把你传进去的普通变量变成响应式数据。

```ts
const count = ref(1)
const double = computed(() => count.value * 2)

effect(() => {
  console.log(double.value)
})
```

依赖关系是：

```text
count → computed 内部 effect → 外层 effect
```

读取 `double.value` 时其实发生两件事：

1. 把当前正在运行的外层 effect 记成 computed 的订阅者
2. 如果 computed 是脏的，执行 getter；getter 读到 `count.value` 时，再把 computed 自己的 effect 记成 `count` 的订阅者

所以“用到 computed 的地方都会走一遍 get”只对了一半。每次读取都会进入取值逻辑，但 getter 只有在依赖变化、computed 被标成 dirty 之后才会重新执行。依赖没变时，读到的是缓存。

这也是依赖必须在执行 getter 时才能确定的原因。下面这种写法，Vue 无法提前知道本次依赖的是 A 还是 B：

```ts
const result = computed(() => {
  return enabled.value ? sourceA.value : sourceB.value
})
```

只有真正跑过 getter，才能记下这次的依赖，并在条件切换后清掉不再使用的旧依赖。

普通 `computed(() => ...)` 是只读的。只有 `computed({ get, set })` 才有写入路径。模板里的 `v-model` 绑到可写 computed 时，读走 get，写走 set。

`count` 变化后的通知顺序是：

```text
count 修改
  → 通知 computed
  → computed 标记为 dirty
  → 通知外层 effect
  → 外层 effect 再次读取 computed
  → 这时才重新计算
```

computed 不会在依赖一变时立刻重算，而是等到下次有人读取它。

## defineProps 是编译宏

`<script setup>` 里没有 `export default { props, emits }`。`defineProps`、`defineEmits` 和 `withDefaults` 会在编译阶段把这些声明挂到组件上，所以它们必须按宏来写，不能当成运行时随便挪到普通函数里。

运行时声明不依赖 TypeScript：

```ts
const props = defineProps({
  loading: { type: Boolean, default: false }
})
```

类型声明则需要 `withDefaults` 来补默认值：

```ts
const props = withDefaults(
  defineProps<{ loading?: boolean }>(),
  { loading: false }
)
```

`withDefaults` 解决的是“类型式 props 如何带默认值”。如果默认值已经写在运行时声明里，就不需要再包一层。

## 响应式负责何时更新，编译负责更新哪里

双向绑定并不是两个方向神秘地连在一起。读取响应式数据时 `track`，写入时 `trigger`，组件渲染函数作为 effect 被调度。模板编译再决定这次要补丁哪些节点。

和“get/set 直接改 DOM”相比，实际模型还多了几层：

- 视图更新只是 render effect，不是另一套机制
- `trigger` 之后会进入调度器，同一轮写入可以合并
- computed 有惰性和 dirty 缓存
- `watch` 有不同的 flush 时机
- `Proxy` 还要处理数组、集合、新增和删除
- 编译器会用 patch flag、静态提升和 block tree 减少补丁范围
- 条件分支切换时，不再使用的依赖会被清理

一句话：响应式系统决定何时更新，编译优化决定更新哪里。

## 同名路由会被后来的注册覆盖

动态菜单经常用 `router.addRoute` 注册路由。Vue Router 按 `name` 索引路由。两个菜单即使路径层级不同，只要 `name` 相同，后注册的那条会覆盖先注册的那条。组件不同也一样。之后导航可能走到错误页面，甚至落到 404。

动态路由的 `name` 需要在整个路由表里唯一，不能只在各自菜单下唯一。
