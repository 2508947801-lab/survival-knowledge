#!/bin/bash
# 每日生存知识系统 · 一键部署到 GitHub Pages
# 用法: bash deploy.sh

cd "$(dirname "$0")"

echo "🐱 正在部署每日生存知识系统..."

# 1. 添加所有新的/修改的HTML文件
git add index.html 生存知识日报_*.html .gitignore 2>/dev/null

# 2. 检查是否有变更
if git diff --cached --quiet; then
    echo "✅ 没有新内容需要部署"
    exit 0
fi

# 3. 提交
TODAY=$(date +%Y-%m-%d)
git commit -m "📰 日报更新 $TODAY"

# 4. 推送
git push origin main

echo ""
echo "✅ 部署完成！"
echo "🔗 访问链接: https://<你的用户名>.github.io/survival-knowledge/"
echo "   (GitHub Pages 生效需要1-2分钟)"