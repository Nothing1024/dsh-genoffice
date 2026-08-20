/**
 * Control-tool schema table and generator (genoffice-dsh-control, Task 18).
 *
 * INV-004 mirror: the table below mirrors contracts/control-api.md §4 (the
 * single source of truth). The plugin and upstream are independent
 * repositories, so the table is embedded here — the stack smoke assertion
 * (`node scripts/dev.mjs smoke` → 契约 ↔ 插件 host 注册) keeps the name set
 * in sync. The generator consumes only this table (never upstream sources at
 * runtime) and produces `defineTool`-ready definitions (Task 19).
 *
 * Parameter specs use the dsh-tools property-map format; union item types are
 * spelled with `oneOf` (the supported union surface). `path` (the target
 * file's absolute path) is a plugin-side addition on every tool: it selects
 * the executor via docId = sha256(path) (BR-009).
 */
import type { ParameterSchemaSpec } from '@deepseek-ai/dsh-tools'

export interface ControlToolEntry {
  /** DSH tool name, e.g. `docx:read_blocks` (INV-004: contracts/control-api.md §4) */
  name: string
  /** upstream skill tool name (AGENT_TOOLS) forwarded to the executor */
  skillName: string
  /** relay control-plane app segment (docx→docs, markdown→markdown, xlsx→sheets, pptx→slides, pdf→pdf) */
  app: 'docs' | 'markdown' | 'sheets' | 'slides' | 'pdf'
  /** model-visible description: skill discipline + control context */
  description: string
  /** defineTool parameter spec (skill inputSchema + the required `path`) */
  parameters: ParameterSchemaSpec
}

/** Absolute-path parameter shared by every control tool. */
const PATH_PARAM = {
  type: 'string' as const,
  required: true as const,
  description: '目标文件的本机绝对路径（必须与 GenOffice tab 中打开的文件一致）',
}

const DOCS_CONTROL_NOTE =
  '该工具操作 GenOffice 网页版中已打开的 docx 文档（控制模式）。所有块索引基于文档当前状态，修改后索引会变化，需重新读取上下文。'

const MARKDOWN_CONTROL_NOTE =
  '该工具操作 GenOffice 网页版中已打开的 markdown 文档（控制模式）。markdown 内容必须是纯 GFM。'

const SHEETS_CONTROL_NOTE =
  '该工具操作 GenOffice 网页版中已打开的 xlsx 工作簿（控制模式）。所有编辑先改 iframe 内工作表，只有 xlsx_save 或 tab「写入磁盘」才会写回原文件。'

const SLIDES_CONTROL_NOTE =
  '该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。'

const PDF_CONTROL_NOTE =
  '该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。'

/**
 * Tool table — the plugin-side mirror of contracts/control-api.md §4.
 * 11 docx tools (10 skill + docx_save) and 5 markdown tools (4 skill + markdown_save).
 * Naming uses `_` instead of `:` (provider tool-name pattern ^[a-zA-Z0-9_-]+$;
 * see the contract's §4 separator note, ASM-006 revision).
 */
export const CONTROL_TOOL_TABLE: ControlToolEntry[] = [
  // ── docx (app: docs) ─────────────────────────────────────────────
  {
    name: 'docx_get_document_context',
    skillName: 'get_document_context',
    app: 'docs',
    description:
      DOCS_CONTROL_NOTE +
      '获取当前文档最新状态：块列表（序号|类型|内容预览）、全文统计与当前选区。块索引会随修改变化，需要最新索引时先调用本工具。',
    parameters: { path: PATH_PARAM },
  },
  {
    name: 'docx_read_blocks',
    skillName: 'read_blocks',
    app: 'docs',
    description:
      DOCS_CONTROL_NOTE +
      '读取一个块范围（0 起、含端点）的完整受限 HTML 内容；长范围分页返回，截断时会给出继续读取的 offset。改写前必须先读取原文。',
    parameters: {
      path: PATH_PARAM,
      startBlockIndex: { type: 'integer', required: true, description: '起始块索引（0 起，含）' },
      endBlockIndex: { type: 'integer', required: true, description: '结束块索引（含）' },
      offset: {
        type: 'integer',
        description: '继续被截断的读取时的字符偏移（默认 0）',
      },
    },
  },
  {
    name: 'docx_insert_content',
    skillName: 'insert_content',
    app: 'docs',
    description:
      DOCS_CONTROL_NOTE +
      '在指定位置插入新内容（受限 HTML，可含多个块）。用于写入/续写/生成新内容；改写现有内容请用 docx:replace_blocks。',
    parameters: {
      path: PATH_PARAM,
      html: { type: 'string', required: true, description: '要插入的受限 HTML 片段' },
      afterBlockIndex: {
        type: 'integer',
        description: '在该块索引之后插入；-1 = 文档开头；缺省 = 光标所在块之后',
      },
    },
  },
  {
    name: 'docx_replace_blocks',
    skillName: 'replace_blocks',
    app: 'docs',
    description:
      DOCS_CONTROL_NOTE +
      '用一个块范围替换为新内容（受限 HTML，新块数量可与旧不同）。用于改写/翻译/压缩/扩写现有内容。',
    parameters: {
      path: PATH_PARAM,
      startBlockIndex: { type: 'integer', required: true, description: '起始块索引（0 起，含）' },
      endBlockIndex: { type: 'integer', required: true, description: '结束块索引（含）' },
      html: { type: 'string', required: true, description: '替换用的受限 HTML 片段' },
    },
  },
  {
    name: 'docx_apply_commands',
    skillName: 'apply_commands',
    app: 'docs',
    description:
      DOCS_CONTROL_NOTE +
      '执行格式化/结构/批量命令（batchUpdate 风格）：文字样式、段落格式、标题级别、查找替换、删除/移动块、列表转换、图片属性。',
    parameters: {
      path: PATH_PARAM,
      commands: {
        type: 'array',
        required: true,
        description: '按序执行的命令数组；每条命令是单键对象',
        items: { type: 'object', additionalProperties: true },
      },
    },
  },
  {
    // UNREGISTERED (handover: dsh:web_search) — 上游放开后需先核对键再暴露
    name: 'docx_web_search',
    skillName: 'web_search',
    app: 'docs',
    description:
      DOCS_CONTROL_NOTE +
      '搜索网页获取文字信息（资料/数据/事实），返回标题/链接/摘要。',
    parameters: {
      path: PATH_PARAM,
      query: { type: 'string', required: true, description: '搜索关键词' },
      maxResults: { type: 'integer', description: '最大结果数，默认 6' },
    },
  },
  {
    // UNREGISTERED (handover: dsh:pending) — 上游放开后需先核对键再暴露
    name: 'docx_image_search',
    skillName: 'image_search',
    app: 'docs',
    description:
      DOCS_CONTROL_NOTE +
      '搜索图片，返回图片链接列表；选定后可用 docx:insert_image 插入。',
    parameters: {
      path: PATH_PARAM,
      query: { type: 'string', required: true, description: '图片搜索关键词' },
      maxResults: { type: 'integer', description: '最大结果数，默认 8' },
    },
  },
  {
    name: 'docx_insert_image',
    skillName: 'insert_image',
    app: 'docs',
    description:
      DOCS_CONTROL_NOTE +
      '插入本机图片；需要网图请先用 DSH 的 web_search 找到来源后由用户下载到本地。imagePath 必须是本机绝对路径。',
    parameters: {
      path: PATH_PARAM,
      imagePath: { type: 'string', required: true, description: '本机图片绝对路径（png/jpeg/webp/gif）' },
      maxWidthPx: { type: 'integer', description: '最大宽度（px），默认 480' },
    },
  },
  {
    name: 'docx_insert_chart',
    skillName: 'insert_chart',
    app: 'docs',
    description:
      DOCS_CONTROL_NOTE +
      '插入图表（原生 Word 图表）。数据必须真实：来自文档内容或 DSH 的 web_search 结果，不得编造数字。',
    parameters: {
      path: PATH_PARAM,
      kind: { type: 'string', required: true, enum: ['bar', 'line', 'pie'], description: '图表类型' },
      title: { type: 'string', description: '图表标题' },
      categories: {
        type: 'array',
        required: true,
        description: '分类（x 轴/扇区）标签',
        items: { type: 'string' },
      },
      series: {
        type: 'array',
        required: true,
        description: '数据系列：values 长度与 categories 相同，缺失用 null；饼图只用第一个系列',
        items: {
          type: 'object',
          additionalProperties: true,
          properties: {
            name: { type: 'string' },
            values: {
              type: 'array',
              required: true,
              items: {
                oneOf: [{ type: 'number' }, { type: 'null' }],
              },
            },
          },
        },
      },
      afterBlockIndex: {
        type: 'integer',
        description: '在该块索引之后插入；-1 = 文档开头；缺省 = 光标所在块之后',
      },
    },
  },
  {
    name: 'docx_edit_chart',
    skillName: 'edit_chart',
    app: 'docs',
    description:
      DOCS_CONTROL_NOTE +
      '编辑文档中已有图表的数据（标题/分类标签/系列名/数值）。分类数量与每个系列的值数量必须与原始图表一致（数据点不可增删）。',
    parameters: {
      path: PATH_PARAM,
      blockIndex: { type: 'integer', required: true, description: '图表的块索引' },
      title: { type: 'string', description: '新标题（省略则保留）' },
      categories: {
        type: 'array',
        description: '新分类标签，长度与原图一致；保留位置传 null',
        items: {
          oneOf: [{ type: 'string' }, { type: 'null' }],
        },
      },
      series: {
        type: 'array',
        description: '要修改的系列',
        items: {
          type: 'object',
          additionalProperties: true,
          properties: {
            index: { type: 'integer', required: true, description: '系列索引（0 起）' },
            name: { type: 'string', description: '新系列名（省略则保留）' },
            values: {
              type: 'array',
              description: '新数值，长度与原系列一致；保留位置传 null',
              items: {
                oneOf: [{ type: 'number' }, { type: 'null' }],
              },
            },
          },
        },
      },
    },
  },
  {
    name: 'docx_save',
    skillName: 'save',
    app: 'docs',
    description:
      DOCS_CONTROL_NOTE +
      '将当前文档内容显式写回原文件（原子写回）。编辑工具只修改网页内状态，只有本工具（或 GenOffice tab 的「写入磁盘」按钮）会真正写盘。',
    parameters: { path: PATH_PARAM },
  },
  // ── markdown (app: markdown) ─────────────────────────────────────
  {
    name: 'markdown_get_document_context',
    skillName: 'get_document_context',
    app: 'markdown',
    description:
      MARKDOWN_CONTROL_NOTE +
      '刷新文档概览：顶层块编号列表（索引|类型|预览）与当前选区。索引编辑前如有疑问先调用本工具。',
    parameters: { path: PATH_PARAM },
  },
  {
    name: 'markdown_read_blocks',
    skillName: 'read_blocks',
    app: 'markdown',
    description:
      MARKDOWN_CONTROL_NOTE +
      '以 markdown 读取一个顶层块范围；长输出分页，提示中会给出继续读取的 offset。',
    parameters: {
      path: PATH_PARAM,
      startIndex: { type: 'integer', required: true, description: '起始块索引（0 起）' },
      endIndex: { type: 'integer', required: true, description: '结束块索引（含）' },
      offset: { type: 'integer', description: '继续被截断读取的字符偏移' },
    },
  },
  {
    name: 'markdown_insert_content',
    skillName: 'insert_content',
    app: 'markdown',
    description:
      MARKDOWN_CONTROL_NOTE +
      '在一个顶层块之后插入新 markdown 内容；afterIndex=-1 插入文档开头；空白文档时替换空段落。',
    parameters: {
      path: PATH_PARAM,
      afterIndex: { type: 'integer', required: true, description: '在其后插入的块索引；-1 = 文档开头' },
      markdown: { type: 'string', required: true, description: '要插入的 Markdown 内容' },
    },
  },
  {
    name: 'markdown_replace_blocks',
    skillName: 'replace_blocks',
    app: 'markdown',
    description:
      MARKDOWN_CONTROL_NOTE +
      '用一个顶层块范围（含端点）替换为新 markdown 内容。用于改写、格式调整和删除（空 markdown 删除该范围）。',
    parameters: {
      path: PATH_PARAM,
      startIndex: { type: 'integer', required: true, description: '起始块索引（0 起）' },
      endIndex: { type: 'integer', required: true, description: '结束块索引（含）' },
      markdown: { type: 'string', required: true, description: '替换用 Markdown；空串 = 删除' },
    },
  },
  {
    name: 'markdown_save',
    skillName: 'save',
    app: 'markdown',
    description:
      MARKDOWN_CONTROL_NOTE +
      '将当前文档内容显式写回原文件（原子写回）。编辑工具只修改网页内状态，只有本工具（或 GenOffice tab 的「写入磁盘」按钮）会真正写盘。',
    parameters: { path: PATH_PARAM },
  },
  // ── xlsx (app: sheets) ──────────────────────────────────────────────
  {
    name: 'xlsx_get_workbook_context',
    skillName: 'get_workbook_context',
    app: 'sheets',
    description:
      SHEETS_CONTROL_NOTE +
      '获取工作簿概览：所有工作表（id/名称/数据范围 行列数）、当前工作表、当前选区、已知非空单元格。' +
      '数据量问题（多少行/多少数据）直接依据数据范围回答，不要逐块读。',
    parameters: { path: PATH_PARAM },
  },
  {
    name: 'xlsx_read_range',
    skillName: 'read_range',
    app: 'sheets',
    description:
      SHEETS_CONTROL_NOTE +
      '按矩形区域读取当前值/公式，返回带行号列标的网格（最多 2000 单元格）。读取前建议先 get_workbook_context 了解数据范围。',
    parameters: {
      path: PATH_PARAM,
      range: { type: 'string', required: true, description: '区域如 "A1:D20"；单格 "B2" 也可' },
    },
  },
  {
    name: 'xlsx_load_guide',
    skillName: 'load_guide',
    app: 'sheets',
    description:
      SHEETS_CONTROL_NOTE +
      '加载操作指南到上下文（字段定义、约定、常见错误）。除最基本的单格读写外，生成 propose_operations 前应加载相关指南。',
    parameters: {
      path: PATH_PARAM,
      guides: {
        type: 'array',
        required: true,
        description: '指南名列表，如 ["writing","formatting"]',
        items: { type: 'string' },
      },
    },
  },
  {
    name: 'xlsx_read_formats',
    skillName: 'read_formats',
    app: 'sheets',
    description:
      SHEETS_CONTROL_NOTE +
      '读取区域内单元格的显式格式（粗体/斜体/下划线/颜色/数字格式/对齐/边框）；只返回有显式格式的单元格，最多 200 个。',
    parameters: {
      path: PATH_PARAM,
      range: { type: 'string', required: true, description: '区域如 "A1:D20"' },
    },
  },
  {
    name: 'xlsx_read_sheet_features',
    skillName: 'read_sheet_features',
    app: 'sheets',
    description:
      SHEETS_CONTROL_NOTE +
      '读取工作表特性状态：自动筛选、条件格式、数据验证、定义名称、冻结窗格、隐藏/保护状态、形状图片、页面设置。修改前先读现状。',
    parameters: {
      path: PATH_PARAM,
      sheetId: { type: 'string', description: '目标工作表 id；省略读取当前工作表' },
    },
  },
  {
    name: 'xlsx_read_cells',
    skillName: 'read_cells',
    app: 'sheets',
    description:
      SHEETS_CONTROL_NOTE +
      '读取散布单元格的当前值/公式（连续区域用 read_range）。写之前必须先读目标单元格，禁止臆测内容。',
    parameters: {
      path: PATH_PARAM,
      addresses: {
        type: 'array',
        required: true,
        description: '单元格地址列表，如 ["A1","B2"]，最多 100 个',
        items: { type: 'string' },
      },
    },
  },
  {
    name: 'xlsx_propose_operations',
    skillName: 'propose_operations',
    app: 'sheets',
    description:
      SHEETS_CONTROL_NOTE +
      '提交一批变更操作并立即应用到工作簿（可用 Undo/⌘Z 回滚）。基础操作：{op:"set_cell",sheetId,address,value} | ' +
      '{op:"set_formula",sheetId,address,formula(以=开头)} | {op:"clear_cell",sheetId,address} | {op:"rename_sheet",sheetId,name}；' +
      '其余操作（format_range/set_range/sort_range/insert_rows/add_sheet/add_table/add_chart 等）字段定义见指南，先 load_guide。' +
      '结构操作不能与其他类别同批；最多 2000 个展开单元格变更；sheetId 必须来自 get_workbook_context。',
    parameters: {
      path: PATH_PARAM,
      operations: {
        type: 'array',
        required: true,
        description: '工作簿 DSL 判别联合格式的操作数组',
        items: { type: 'object', additionalProperties: true },
      },
      summary: { type: 'string', required: true, description: '本批变更的一句话总结' },
    },
  },
  {
    name: 'xlsx_save',
    skillName: 'save',
    app: 'sheets',
    description:
      SHEETS_CONTROL_NOTE +
      '将当前工作簿内容显式写回原文件（原子写回，tmp+rename）。编辑工具只修改网页内状态，只有本工具（或 tab「写入磁盘」按钮）会真正写盘。',
    parameters: { path: PATH_PARAM },
  },
  // ── pptx (app: slides) ──────────────────────────────────────────────
  {
    name: 'pptx_get_deck_context',
    skillName: 'get_deck_context',
    app: 'slides',
    description:
      SLIDES_CONTROL_NOTE +
      '获取演示文稿最新大纲：每页文本元素列表（元素 id | 类型 | 文本预览）。编辑后确认全局状态时调用。',
    parameters: { path: PATH_PARAM },
  },
  {
    name: 'pptx_read_slide',
    skillName: 'read_slide',
    app: 'slides',
    description:
      SLIDES_CONTROL_NOTE +
      '读取一页的全部元素：完整文本（不截断）与当前颜色（填充/文本/描边，hex）。改写一页前必须先调用。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true, description: '页码（0 起）' },
    },
  },
  {
    name: 'pptx_set_element_text',
    skillName: 'set_element_text',
    app: 'slides',
    description:
      SLIDES_CONTROL_NOTE +
      '替换一个文本元素的全部内容。paragraphs 为替换后的完整段落数组，每段一个对象；整段粗体/斜体等用段落上的布尔字段。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true, description: '页码（0 起）' },
      sourceId: { type: 'string', required: true, description: '元素 id（来自大纲/read_slide）' },
      paragraphs: {
        type: 'array',
        required: true,
        description: '完整段落数组（替换全部内容）',
        items: {
          type: 'object',
          additionalProperties: true,
          properties: {
            text: { type: 'string' },
            bold: { type: 'boolean' },
            italic: { type: 'boolean' },
            underline: { type: 'boolean' },
            fontSize: { type: 'number' },
            fontFamily: { type: 'string' },
            color: { type: 'string', description: '#RRGGBB' },
          },
        },
      },
    },
  },
  {
    name: 'pptx_set_element_style',
    skillName: 'set_element_style',
    app: 'slides',
    description:
      SLIDES_CONTROL_NOTE +
      '修改元素文本格式（不改文字）：字号/颜色/粗体/斜体/下划线/对齐/字体。只传要改的字段。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      sourceId: { type: 'string', required: true },
      fontSize: { type: 'number', description: '字号（pt）' },
      color: { type: 'string', description: '#RRGGBB' },
      bold: { type: 'boolean' },
      italic: { type: 'boolean' },
      underline: { type: 'boolean' },
      fontFamily: { type: 'string', description: '字体名；通常省略继承主题' },
      align: { type: 'string', enum: ['left', 'center', 'right'] },
    },
  },
  {
    name: 'pptx_set_element_transform',
    skillName: 'set_element_transform',
    app: 'slides',
    description:
      SLIDES_CONTROL_NOTE +
      '移动/缩放/旋转元素（像素坐标，原点左上，画布宽 1280）。只传要改的字段。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      sourceId: { type: 'string', required: true },
      x: { type: 'number', description: '左上角 x（px）' },
      y: { type: 'number', description: '左上角 y（px）' },
      w: { type: 'number', description: '宽（px）' },
      h: { type: 'number', description: '高（px）' },
      rotationDeg: { type: 'number', description: '旋转角（度，顺时针）' },
    },
  },
  {
    name: 'pptx_execute_slide_script',
    skillName: 'execute_slide_script',
    app: 'slides',
    description:
      SLIDES_CONTROL_NOTE +
      '执行幻灯片脚本（多属性/多元素/相对微调/对齐分布用脚本）。脚本 API：setText(id, text|paragraphs)、setStyle(id, {fontSize,color,bold,…})、' +
      'setTransform(id, {x,y,w,h,rotationDeg})、setFill(id, color|"none")、setStroke(id, {color,widthPt}|null)、addText/addShape、remove(id)、align/distribute。' +
      '画布 1280×720，坐标像素。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      code: { type: 'string', required: true, description: 'JavaScript 脚本源码（上游键名 code）' },
      explanation: { type: 'string', description: '脚本意图说明（可选）' },
    },
  },
  {
    name: 'pptx_set_element_fill',
    skillName: 'set_element_fill',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '设置元素实心填充。fill=#RRGGBB；传 "none" 取消填充。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      sourceId: { type: 'string', required: true },
      fill: { type: 'string', required: true, description: '#RRGGBB 或 none' },
    },
  },
  {
    name: 'pptx_set_element_stroke',
    skillName: 'set_element_stroke',
    app: 'slides',
    description:
      SLIDES_CONTROL_NOTE +
      '设置元素描边。传 color（#RRGGBB）+ widthPt（磅）；remove=true 移除描边。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      sourceId: { type: 'string', required: true },
      color: { type: 'string', description: '#RRGGBB' },
      widthPt: { type: 'number', description: '线宽（磅）' },
      remove: { type: 'boolean', description: 'true = 移除描边' },
    },
  },
  {
    // UNREGISTERED (handover: dsh:web_search) — 上游放开后需先核对键再暴露
    name: 'pptx_web_search',
    skillName: 'web_search',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '搜索网页获取文字信息，返回标题/链接/摘要。',
    parameters: {
      path: PATH_PARAM,
      query: { type: 'string', required: true, description: '搜索关键词' },
      maxResults: { type: 'integer', description: '最大结果数，默认 6' },
    },
  },
  {
    // UNREGISTERED (handover: dsh:pending) — 上游放开后需先核对键再暴露
    name: 'pptx_image_search',
    skillName: 'image_search',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '搜索图片返回链接列表（配合 insert_web_image 使用）。',
    parameters: {
      path: PATH_PARAM,
      query: { type: 'string', required: true, description: '图片搜索关键词（建议英文）' },
      maxResults: { type: 'integer', description: '最大结果数，默认 8' },
    },
  },
  {
    // UNREGISTERED (handover: dsh:pending + bridge-missing) — 即使上游补桥接也不放开
    name: 'pptx_generate_image',
    skillName: 'generate_image',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + 'Genspark AI 图片生成/编辑（网页版不可用，返回错误）。',
    parameters: {
      path: PATH_PARAM,
      prompt: { type: 'string', required: true },
      model: { type: 'string' },
    },
  },
  {
    name: 'pptx_analyze_media',
    skillName: 'analyze_media',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '媒体内容理解分析（网页版不可用，返回错误）。',
    parameters: {
      path: PATH_PARAM,
      mediaUrls: { type: 'array', required: true, items: { type: 'string' } },
      requirements: { type: 'string', required: true },
    },
  },
  {
    // UNREGISTERED (bridge-missing) — 上游放开后需先修键（xPx→x 等）再暴露
    name: 'pptx_insert_web_image',
    skillName: 'insert_web_image',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '把网络图片插入当前页（返回更新页 + 新元素 id）。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      url: { type: 'string', required: true, description: '图片直链' },
      xPx: { type: 'number' },
      yPx: { type: 'number' },
      wPx: { type: 'number' },
      hPx: { type: 'number' },
    },
  },
  {
    // UNREGISTERED (bridge-missing) — 上游放开后需先修键（srcRect→l/t/r/b）再暴露
    name: 'pptx_crop_image',
    skillName: 'crop_image',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '裁剪图片（srcRect 0..1 比例）。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      sourceId: { type: 'string', required: true },
      srcRect: {
        type: 'object',
        required: true,
        additionalProperties: true,
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          w: { type: 'number' },
          h: { type: 'number' },
        },
      },
    },
  },
  {
    name: 'pptx_set_picture_opacity',
    skillName: 'set_picture_opacity',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '整图透明度（0..100）。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      sourceId: { type: 'string', required: true },
      opacity: { type: 'number', required: true, description: '0..100' },
    },
  },
  {
    name: 'pptx_replace_image',
    skillName: 'replace_image',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '原地替换图片（框/层级/效果保留）。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      sourceId: { type: 'string', required: true },
      url: { type: 'string', required: true, description: '新图片直链' },
    },
  },
  {
    name: 'pptx_ask_clarification',
    skillName: 'ask_clarification',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '向用户提出澄清问题（需 AI 面板交互，控制模式下不可用）。',
    parameters: {
      path: PATH_PARAM,
      questions: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          additionalProperties: true,
          properties: { label: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } },
        },
      },
    },
  },
  {
    name: 'pptx_plan_deck',
    skillName: 'plan_deck',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '演示大纲规划。',
    parameters: {
      path: PATH_PARAM,
      core_hook: { type: 'string', required: true, description: '核心钩子 / 主题一句话' },
      style: { type: 'string' },
      pages: { type: 'integer', description: '目标页数' },
    },
  },
  {
    // UNREGISTERED (cloud-only) — 上游放开后需先修键（html→brief/title/layout）再暴露
    name: 'pptx_regenerate_slide',
    skillName: 'regenerate_slide',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '用单页 HTML 重做一页（依赖 LLM 管线，控制模式下通常不可用）。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      html: { type: 'string', required: true },
    },
  },
  {
    name: 'pptx_delete_slide',
    skillName: 'delete_slide',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '删除一页（只剩一页时拒绝）。返回完整页数组。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
    },
  },
  {
    // UNREGISTERED (cloud-only) — 上游放开后需先修键（topic→core_hook）再暴露
    name: 'pptx_generate_deck',
    skillName: 'generate_deck',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '生成整套演示（依赖 LLM 管线，控制模式下通常不可用）。',
    parameters: {
      path: PATH_PARAM,
      topic: { type: 'string', required: true },
      style: { type: 'string' },
      approx_pages: { type: 'integer' },
    },
  },
  {
    // UNREGISTERED (state-locked) — 上游放开后需先去掉 styleSkill 再暴露
    name: 'pptx_save_style_template',
    skillName: 'save_style_template',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '保存样式模板（网页版不可用，返回错误）。',
    parameters: {
      path: PATH_PARAM,
      name: { type: 'string', required: true },
      styleSkill: { type: 'string', required: true },
    },
  },
  {
    name: 'pptx_list_style_templates',
    skillName: 'list_style_templates',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '列出样式模板（网页版返回空）。',
    parameters: { path: PATH_PARAM },
  },
  {
    name: 'pptx_add_slide',
    skillName: 'add_slide',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '在指定页之后复制一页（clearText=true 清空文本）。',
    parameters: {
      path: PATH_PARAM,
      sourceIndex: { type: 'integer', required: true, description: '复制源页码（0 起）' },
      clearText: { type: 'boolean' },
    },
  },
  {
    name: 'pptx_add_text_box',
    skillName: 'add_text_box',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '添加文本框（x/y/w/h 像素；paragraphs 富文本）。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      x: { type: 'number', required: true },
      y: { type: 'number', required: true },
      w: { type: 'number', required: true },
      h: { type: 'number', required: true },
      paragraphs: {
        type: 'array',
        description: '富文本段落',
        items: { type: 'object', additionalProperties: true },
      },
    },
  },
  {
    name: 'pptx_add_shape',
    skillName: 'add_shape',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '添加形状（kind 形状预设，fillColor / paragraphs 可选）。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      kind: { type: 'string', required: true, description: '形状预设名' },
      x: { type: 'number', required: true },
      y: { type: 'number', required: true },
      w: { type: 'number', required: true },
      h: { type: 'number', required: true },
      fillColor: { type: 'string', description: '#RRGGBB' },
      paragraphs: {
        type: 'array',
        description: '形状内文本段落',
        items: { type: 'object', additionalProperties: true },
      },
    },
  },
  {
    // UNREGISTERED (bridge-missing) — 上游放开后需先补齐缺参再暴露
    name: 'pptx_add_chart',
    skillName: 'add_chart',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '添加图表（网页版不可用，返回错误）。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      kind: { type: 'string', required: true },
    },
  },
  {
    name: 'pptx_add_smartart',
    skillName: 'add_smartart',
    app: 'slides',
    description:
      SLIDES_CONTROL_NOTE +
      '插入 SmartArt 风格示意图（list=纵向列表、process=流程箭头、cycle=循环、hierarchy=层级、pyramid=金字塔、matrix=2x2、venn=维恩）。items 为节点文本。省略 x/y/w/h 时居中。空白 deck 会被上游守卫拒绝。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      layout: {
        type: 'string',
        required: true,
        enum: ['list', 'process', 'cycle', 'hierarchy', 'pyramid', 'matrix', 'venn'],
        description: '示意图布局',
      },
      items: {
        type: 'array',
        required: true,
        items: { type: 'string' },
        description: '节点文本（建议 2–8 项）',
      },
      x: { type: 'number' },
      y: { type: 'number' },
      w: { type: 'number' },
      h: { type: 'number' },
    },
  },
  {
    // UNREGISTERED (bridge-missing) — 上游放开后需先补齐缺参再暴露
    name: 'pptx_add_table',
    skillName: 'add_table',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '添加表格（网页版不可用，返回错误）。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      rows: { type: 'integer', required: true },
      cols: { type: 'integer', required: true },
    },
  },
  {
    name: 'pptx_edit_table_cell',
    skillName: 'edit_table_cell',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '编辑表格单元格文本（网页版不可用，返回错误）。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      sourceId: { type: 'string', required: true },
      cellId: { type: 'string', required: true },
      text: { type: 'string', required: true },
    },
  },
  {
    name: 'pptx_edit_table_structure',
    skillName: 'edit_table_structure',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '表格行列增删（网页版不可用，返回错误）。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      sourceId: { type: 'string', required: true },
      action: { type: 'string', required: true, enum: ['addRow', 'addCol', 'delRow', 'delCol'] },
    },
  },
  {
    name: 'pptx_edit_table_style',
    skillName: 'edit_table_style',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '编辑表格样式（网页版不可用，返回错误）。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      sourceId: { type: 'string', required: true },
      style: { type: 'object', required: true, additionalProperties: true },
    },
  },
  {
    name: 'pptx_edit_chart',
    skillName: 'edit_chart',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '编辑图表数据（网页版不可用，返回错误）。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      sourceId: { type: 'string', required: true },
      data: { type: 'object', required: true, additionalProperties: true },
    },
  },
  {
    name: 'pptx_set_slide_background',
    skillName: 'set_slide_background',
    app: 'slides',
    description:
      SLIDES_CONTROL_NOTE + '设置页面背景色。slideIndex=-1 应用到所有页。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true, description: '页码（0 起）；-1 = 全部' },
      color: { type: 'string', required: true, description: '#RRGGBB' },
    },
  },
  {
    name: 'pptx_delete_element',
    skillName: 'delete_element',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '删除页内一个元素。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      sourceId: { type: 'string', required: true },
    },
  },
  {
    name: 'pptx_ungroup_element',
    skillName: 'ungroup_element',
    app: 'slides',
    description: SLIDES_CONTROL_NOTE + '取消组合（网页版不可用，返回错误）。',
    parameters: {
      path: PATH_PARAM,
      slideIndex: { type: 'integer', required: true },
      sourceId: { type: 'string', required: true },
    },
  },
  {
    name: 'pptx_save',
    skillName: 'save',
    app: 'slides',
    description:
      SLIDES_CONTROL_NOTE +
      '将当前演示文稿内容显式写回原文件（原子写回，tmp+rename）。编辑工具只修改网页内状态，只有本工具（或 tab「写入磁盘」按钮）会真正写盘。',
    parameters: { path: PATH_PARAM },
  },
  // ── pdf (app: pdf) ──────────────────────────────────────────────────
  {
    name: 'pdf_read_pages',
    skillName: 'read_pages',
    app: 'pdf',
    description:
      PDF_CONTROL_NOTE +
      '读取一页或多页的文本内容（带 [Page N] 标记）。回答文档内容问题前先读取相关页；一次最多 10 页。',
    parameters: {
      path: PATH_PARAM,
      start: { type: 'integer', required: true, description: '起始页码（1 起）' },
      end: { type: 'integer', description: '结束页码（含）；省略只读起始页' },
    },
  },
  {
    name: 'pdf_search_text',
    skillName: 'search_text',
    app: 'pdf',
    description:
      PDF_CONTROL_NOTE +
      '全文搜索字符串，返回页码与上下文摘录。定位某内容在哪一页时优先用本工具。',
    parameters: {
      path: PATH_PARAM,
      query: { type: 'string', required: true, description: '搜索文本（大小写不敏感）' },
    },
  },
  {
    name: 'pdf_goto_page',
    skillName: 'goto_page',
    app: 'pdf',
    description: PDF_CONTROL_NOTE + '跳转到指定页（页码 1 起）；页已删除时返回 false。',
    parameters: {
      path: PATH_PARAM,
      page: { type: 'integer', required: true, description: '目标页码（1 起）' },
    },
  },
  {
    name: 'pdf_markup_text',
    skillName: 'markup_text',
    app: 'pdf',
    description:
      PDF_CONTROL_NOTE +
      '给一段文本加标注（高亮/下划线/删除线）。text 必须是该页存在的原文片段（先用 read_pages 或 search_text 确认）；默认只标第一处，all=true 标全部。',
    parameters: {
      path: PATH_PARAM,
      page: { type: 'integer', required: true, description: '页码（1 起）' },
      text: { type: 'string', required: true, description: '页面上的原文片段' },
      type: {
        type: 'string',
        required: true,
        enum: ['highlight', 'underline', 'strikeout'],
        description: '标注类型',
      },
      all: { type: 'boolean', description: '是否标注该页所有出现处；默认 false' },
    },
  },
  {
    name: 'pdf_edit_text',
    skillName: 'edit_text',
    app: 'pdf',
    description:
      PDF_CONTROL_NOTE +
      '替换页面上一个短文本片段（改写 PDF 内容流，保存时生效）。old_text 必须是该页存在的原文；只改第一处（除非给 occurrence）。' +
      '替换文本在原位置绘制、不重排页面，长度宜接近原文；不能删除文本（new_text 非空）。',
    parameters: {
      path: PATH_PARAM,
      page: { type: 'integer', required: true, description: '页码（1 起）' },
      old_text: { type: 'string', required: true, description: '页面上的原文片段' },
      new_text: { type: 'string', required: true, description: '替换文本；"\\n" 分多行' },
      occurrence: { type: 'integer', description: '第几处出现（1 起）；默认 1' },
      font_size: { type: 'number', description: '新字号（pt）；省略保持原字号' },
      color: { type: 'string', description: '新文本颜色 #RRGGBB；省略保持原色' },
      font: { type: 'string', enum: ['arial', 'times', 'courier'], description: '替换字体' },
      bold: { type: 'boolean', description: '加粗' },
      italic: { type: 'boolean', description: '斜体' },
    },
  },
  {
    name: 'pdf_edit_block',
    skillName: 'edit_block',
    app: 'pdf',
    description:
      PDF_CONTROL_NOTE +
      '重写整段（自动换行重排，块内向下生长）。paragraph_text 是定位段落的独特片段（必须唯一匹配一段）；整段替换为 new_text。改几个词用 edit_text。',
    parameters: {
      path: PATH_PARAM,
      page: { type: 'integer', required: true },
      paragraph_text: { type: 'string', required: true, description: '定位段落的原文片段' },
      new_text: { type: 'string', required: true, description: '整段替换文本' },
      font_size: { type: 'number' },
      color: { type: 'string', description: '#RRGGBB' },
      font: { type: 'string', enum: ['arial', 'times', 'courier'] },
      bold: { type: 'boolean' },
      italic: { type: 'boolean' },
    },
  },
  {
    name: 'pdf_image_search',
    skillName: 'image_search',
    app: 'pdf',
    description: PDF_CONTROL_NOTE + '搜索图片返回链接列表（配合 insert_image）。',
    parameters: {
      path: PATH_PARAM,
      query: { type: 'string', required: true, description: '图片搜索关键词（建议英文）' },
      max_results: { type: 'integer', description: '最大结果数，默认 8' },
    },
  },
  {
    name: 'pdf_generate_image',
    skillName: 'generate_image',
    app: 'pdf',
    description: PDF_CONTROL_NOTE + 'AI 图片生成（网页版不可用，返回错误）。',
    parameters: {
      path: PATH_PARAM,
      prompt: { type: 'string', required: true },
      aspect_ratio: { type: 'string' },
    },
  },
  {
    name: 'pdf_list_page_images',
    skillName: 'list_page_images',
    app: 'pdf',
    description: PDF_CONTROL_NOTE + '列出页内图片（网页版不可用，返回空）。',
    parameters: {
      path: PATH_PARAM,
      page: { type: 'integer', required: true },
    },
  },
  {
    // UNREGISTERED (bridge-missing) — 上游放开后需先修键（w/h→width 等）再暴露
    name: 'pdf_insert_image',
    skillName: 'insert_image',
    app: 'pdf',
    description: PDF_CONTROL_NOTE + '插入图片（网页版不可用，返回错误）。',
    parameters: {
      path: PATH_PARAM,
      page: { type: 'integer', required: true },
      url: { type: 'string', required: true },
      x: { type: 'number' },
      y: { type: 'number' },
      w: { type: 'number' },
      h: { type: 'number' },
    },
  },
  {
    name: 'pdf_transform_image',
    skillName: 'transform_image',
    app: 'pdf',
    description: PDF_CONTROL_NOTE + '移动/缩放图片（网页版不可用，返回错误）。',
    parameters: {
      path: PATH_PARAM,
      page: { type: 'integer', required: true },
      image_index: { type: 'integer', required: true },
      x: { type: 'number' },
      y: { type: 'number' },
      w: { type: 'number' },
      h: { type: 'number' },
    },
  },
  {
    name: 'pdf_rotate_image',
    skillName: 'rotate_image',
    app: 'pdf',
    description: PDF_CONTROL_NOTE + '旋转图片（网页版不可用，返回错误）。',
    parameters: {
      path: PATH_PARAM,
      page: { type: 'integer', required: true },
      image_index: { type: 'integer', required: true },
      direction: { type: 'string', enum: ['left', 'right'], required: true },
    },
  },
  {
    name: 'pdf_replace_image',
    skillName: 'replace_image',
    app: 'pdf',
    description: PDF_CONTROL_NOTE + '原地替换图片（网页版不可用，返回错误）。',
    parameters: {
      path: PATH_PARAM,
      page: { type: 'integer', required: true },
      image_index: { type: 'integer', required: true },
      url: { type: 'string', required: true },
    },
  },
  {
    name: 'pdf_delete_image',
    skillName: 'delete_image',
    app: 'pdf',
    description: PDF_CONTROL_NOTE + '删除图片（网页版不可用，返回错误）。',
    parameters: {
      path: PATH_PARAM,
      page: { type: 'integer', required: true },
      image_index: { type: 'integer', required: true },
    },
  },
  {
    name: 'pdf_list_form_fields',
    skillName: 'list_form_fields',
    app: 'pdf',
    description: PDF_CONTROL_NOTE + '列出表单字段。',
    parameters: { path: PATH_PARAM },
  },
  {
    name: 'pdf_fill_form_field',
    skillName: 'fill_form_field',
    app: 'pdf',
    description: PDF_CONTROL_NOTE + '填写表单字段。',
    parameters: {
      path: PATH_PARAM,
      name: { type: 'string', required: true, description: '字段名' },
      value: { type: 'string', required: true },
      checked: { type: 'boolean', description: '复选框是否勾选' },
    },
  },
  {
    name: 'pdf_rotate_page',
    skillName: 'rotate_page',
    app: 'pdf',
    description: PDF_CONTROL_NOTE + '旋转页面（direction: left/right，90°）。',
    parameters: {
      path: PATH_PARAM,
      page: { type: 'integer', required: true },
      direction: { type: 'string', enum: ['left', 'right'], required: true },
    },
  },
  {
    name: 'pdf_delete_page',
    skillName: 'delete_page',
    app: 'pdf',
    description: PDF_CONTROL_NOTE + '删除页面（至少保留一页）。',
    parameters: {
      path: PATH_PARAM,
      page: { type: 'integer', required: true },
    },
  },
  {
    name: 'pdf_get_outline',
    skillName: 'get_outline',
    app: 'pdf',
    description: PDF_CONTROL_NOTE + '读取文档大纲（书签层级）。',
    parameters: { path: PATH_PARAM },
  },
  {
    name: 'pdf_save',
    skillName: 'save',
    app: 'pdf',
    description:
      PDF_CONTROL_NOTE +
      '将当前文档（含标注与文本改写）显式写回原文件（原子写回，tmp+rename）。编辑工具只修改网页内状态，只有本工具（或 tab「写入磁盘」按钮）会真正写盘。',
    parameters: { path: PATH_PARAM },
  },
]

/** Whether a table entry is the write-back trigger (BR-008). */
export function isSaveEntry(entry: ControlToolEntry): boolean {
  return entry.skillName === 'save'
}
