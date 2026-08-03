# SigmaMiner

材料科学文献驱动的科学发现智能体 · GOAI 世界人工智能大赛 赛道三 · 方向三 · 主题一

**任务**：argyrodite Li6PS5Cl 固态电解质合成路线与工艺优化（路线 C）

在线 Demo：<https://LC-di-yan.github.io/SigmaMiner/>

## 这是什么

一个把「文献检索 → 结构化抽取 → 研究空白识别 → 假设生成 → 合成路线设计 → 证据回溯 → 对照验证」全链路跑成可运行闭环的智能体。站点本身为纯静态页（无框架、无后端、无密钥），所有数字都锚定到本地证据链，可一键回溯原文。

## 本地复现

```bash
python scripts/build_demo.py          # 从 data/ 聚合生成 demo_site/data/app.json
cd demo_site && python -m http.server 8000
```

打开 <http://localhost:8000/> 即可预览。

## 目录结构

```
demo_site/
  index.html          # 单页结构
  assets/
    style.css         # 深色科技主题
    app.js            # 原生 JS 渲染器
    figures/          # 构建时从 figures/ 复制的示意图
  data/app.json       # 构建产物：全部聚合数据（可回溯）
```

## 两层架构

- **数据 / 审计层**：自研纯 Python 标准库流水线（`agent/`），零第三方依赖，evaluate / compare 确定性一致。
- **编排层**：AgentScope 2.0（Apache-2.0）discover 循环 —— 自主读知识库、判断证据不足、触发补检、生成并写回 Gap / 假设 / 路线。

## License

[Apache-2.0](LICENSE)
