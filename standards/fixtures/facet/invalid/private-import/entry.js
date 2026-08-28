// 非法 fixture：facet entry 直接 import 上游私有包 → [private-import]。
// 源码扫描先于动态装载（fail closed），本文件不会真的被执行。
import 'cordis'

export default {
  [Symbol.for('dsh-community-standard.facet-definition')]: true,
  name: 'fixture.private-import',
  setup() {},
}
