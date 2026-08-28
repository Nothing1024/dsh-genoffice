// 非法 fixture：默认导出是普通对象，缺 defineFacet 品牌 → [not-a-facet]。
export default {
  name: 'fixture.not-a-facet',
  setup() {},
}
