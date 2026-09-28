# 逻辑、表单和组件，分别该抽到哪一层

重复出现三次之后，最容易做的决定是“抽成公共的”。真正要先回答的是：重复的是稳定协议，还是只是现在长得像。

这和[业务页面该不该复用](/notes/multi-business-architecture-boundaries)是相邻的问题。那篇讨论的是整页会不会因为业务分化而绑死。这篇讨论更小的三块：带状态的逻辑、搜索表单，以及一个可复用的交互组件。

## Composable：抽走状态逻辑，不增加组件层级

Composable 是一个 `useXxx()` 函数。它把可复用的状态和操作放在一起，组件里只负责组装。

抽之前，搜索、加载和表格数据经常直接写在页面里。抽之后可以变成：

```ts
export function useSearchPage(query: Ref<QueryParams>) {
  const loading = ref(false)
  const rows = ref<Row[]>([])
  const summary = ref<Summary>({})

  async function search() {
    loading.value = true
    const result = await fetchReport(query.value)
    rows.value = result.rows ?? []
    summary.value = result.summary ?? {}
    loading.value = false
  }

  return { loading, rows, summary, search }
}
```

页面变成：

```ts
const query = ref<QueryParams>({ ...defaults })
const { loading, rows, summary, search } = useSearchPage(query)
```

它和工具函数的差别在于：工具函数只做一次计算或格式转换；composable 持有 `ref`、`computed`、`watch`，还能把加载、请求和结果一起交出去。它和再包一层组件的差别在于：不增加模板层级。

适合先抽 composable 的信号是：同一段请求、缓存或提交流程已经在两个页面里各写一遍，而界面仍然不同。

## Schema：描述表单长什么样

只把字段名放进一个字符串数组，模板里仍然是几十个 `v-if`。这只说明“显示哪些字段”，组件类型、占位文案、远程搜索和字段映射还是写死在一个大组件里。

Schema 把这些也变成数据：

```ts
export const reportSearchSchema = [
  { key: 'range', type: 'dateRange', label: '日期', mapTo: ['start', 'end'] },
  { key: 'owner', type: 'userSelect', fields: ['userId', 'deptIds'] },
  { key: 'itemIds', type: 'remoteMultiSelect', fetch: 'items' }
]
```

通用渲染器按 `type` 决定渲染日期、人员还是远程多选。新增一个常规筛选项时，改的是这份配置，而不是一个上千行的搜索栏。

代价也明确：要先设计 schema 和渲染器；级联、批量输入这类特殊交互要么扩展 `type`，要么留 slot。筛选项还不多、页面差异主要在请求时，先抽 composable 更划算。字段会继续增加、多个页面结构高度相似时，再把“显示哪些 key”升级成完整 schema。

两者可以同时存在：schema 负责长什么样，composable 负责数据怎么拉、查询怎么发。

## 组件：固定交互协议，把副作用留在页面

公共组件该规定的是形态，不是业务。以“远程多选 + 批量粘贴 ID”为例，可以拆成三层：

```text
L1  批量粘贴弹窗        只负责多行文本、校验和确认
L2  远程多选外壳        L1 + 选择器、加载态和批量按钮
L3  页面搜索栏          表单编排、接口、store 和是否启用
```

L2 里应该固定的是所有同类筛选项都一样的契约：值是 ID 数组、有下拉和加载态、右侧能打开批量输入。组件内部不应该写具体接口、store 更新、权限或某个页面的防抖。

可以有默认值、也能被覆盖的，用 props：占位文案、弹窗标题、批量上限、选项的 value 和 label 字段。大约八成场景用默认值，剩下的只改一两个 prop。

必须交给页面的，用事件抛出去：远程搜索、失焦后恢复选项、选中后的缓存。这里有一个容易写错的细节。批量确认只更新 `v-model`，不额外发出“用户从下拉里点了一项”的 change。因为粘贴一组 ID 时，页面只关心查询参数；从下拉里单选时，才需要顺手更新最近选择。用不同事件区分副作用，而不是在公共组件里写 `if (某个页面)`。

不要传进公共组件的东西：API 函数、store、页面级开关、整份字段配置。

新增一个批量筛选项时可以按这个顺序看：

- 交互是远程多选加 ID 数组，复用 L2
- 只需要粘贴弹窗，复用 L1
- 是输入框加“按 ID / 按名称”切换，那是另一种外壳，不要往 Select 上继续加 prop
- 第二处用法还没出现，可以先复制；第三处再抽象
- 旧页面已经稳定，新需求用新组件，不必顺手改旧实现

## 重复出现的上传字段要有自己的状态

列表表单里每一行都有上传时，也是同一类边界。上传组件自己持有文件列表。如果多行共用一个文件列表，新增、删除和回显会对错行。

列表容器如果只暴露“加一行、删一行”，却拿不到行下标，页面就无法把某一行的文件写回对应答案。这时不该把上传逻辑塞进公共列表，而该让每一行成为自己的表单单元，由这一行持有文件状态，提交前再做整体校验。

## 怎么选

先问重复是否稳定、差异能不能参数化。

- 重复的是请求和状态：抽 composable
- 重复的是字段排列，而且字段还会增加：再考虑 schema
- 重复的是同一套交互：抽组件，并规定哪些 props 必须传、哪些事件必须由页面实现
- 只有外壳相似、输入形态不同：另做一层，不要把差异都变成 prop

抽这三样都不是为了少一个文件，而是把不会变的协议固定下来，把文案、数据源和副作用留在使用它的地方。
