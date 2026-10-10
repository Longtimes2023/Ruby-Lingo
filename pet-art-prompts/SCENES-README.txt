RubyLingo 场景图生成清单

文件：scenes-prompts.json（10 个场景，每个 ID 一条独立提示词）。

状态（2026-10-10 核对）：
- 9 个主题场景（at-the-zoo、my-body、at-the-clothes-shop、my-friends-birthday、
  my-favourite-food、at-home、at-school、at-the-beach、my-street）此前已在
  rubylingo/public/assets/scenes/ 有 .webp 文件，本轮**未重新生成、未覆盖**。
- 仅 home-scene 缺文件，本轮已生成：rubylingo/public/assets/scenes/home-scene.webp
  （1024×683，约 111 KB，WebP 质量 82）。
- 每个条目的 status 字段由脚本按磁盘文件是否存在自动填写（generated / missing）。
- 校验器 scripts/validate-content.ts 原先指向不存在的 assets/scenes/，导致 9 个真实存在的
  主题场景被误报 V12 缺失；已修正为 public/assets/scenes/。修正后 npm run validate:content
  为 0 错误、0 警告。

使用方式
1. 在可用的图像生成工具中逐条提交 JSON 的 prompt 字段，按 id 分别生成；建议一次生成一张，避免同秒生成文件重名覆盖。
2. 保存生成的原图到 rubylingo/asset-src/scenes/，文件名按 filename 字段（例如 at-the-zoo.png）。生成后先人工检查主题辨识度、儿童友好度、构图及风格一致性。
3. 项目现有转换脚本 rubylingo/asset-src/convert_scenes.py 面向既有九个场景，有固定输入映射且执行时会删除一个旧冗余文件；不要直接用它处理本清单。审核通过后，另行安全地将图片裁成 3:2、缩放至约 1024px 宽并导出质量约 82 的 WebP，命名为 JSON 的 output 字段（例如 at-the-zoo.webp），放到 rubylingo/public/assets/scenes/。

共用规格：横向 3:2，面向网页主题横幅小尺寸阅读；原创、柔和明亮的 3D 儿童动画插画风格，圆润造型、柔和自然光、平衡鲜明色彩和轻柔阴影；主体集中在画面中央约 70%，边缘留白；场景整洁易辨认且适龄。避免文字、标识、品牌、边框、水印。提示词为英文以便图像模型理解；主题和文件名以稳定场景 ID 对齐。
