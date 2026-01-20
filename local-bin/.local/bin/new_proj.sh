#!/usr/bin/env bash
set -e

# --- 颜色与装饰 ---

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# --- 配置 ---
TEMPLATE_BASE="${COPIER_TMPL_PATH:-$HOME/.local/share/proj-templates}"

# --- 检查依赖 ---
if ! command -v fzf &>/dev/null; then
  echo -e "${YELLOW}提示: 本脚本需要 fzf，正在通过 mise 临时调用...${NC}"
  # 如果没装 fzf，我们可以尝试通过 mise 运行一次
fi

# --- 1. 选择模板 (使用 fzf) ---
if [ ! -d "$TEMPLATE_BASE" ]; then
  echo -e "${YELLOW}Error: 模板根目录 $TEMPLATE_BASE 不存在${NC}"
  exit 1
fi

# 调整 fzf 视觉效果
SELECTED_TPL=$(
  ls "$TEMPLATE_BASE" | fzf \
    --height 40% \
    --layout=reverse \
    --border \
    --header "请选择项目模板 (ESC 退出)" \
    --color="header:italic:underline,fg+:bold:green" \
    --prompt="❯ "
)

if [ -z "$SELECTED_TPL" ]; then
  echo -e "${YELLOW}已取消选择${NC}"
  exit 0

fi

# --- 2. 交互式获取目标路径 ---
echo -e "\n${BLUE}${BOLD}󰚌 已选择模板:${NC} ${GREEN}${BOLD}$SELECTED_TPL${NC}"
echo -ne "${BLUE}${BOLD}📂 请输入项目目标路径 [默认: .]:${NC} "
read -r INPUT_DIR
TARGET_DIR="${INPUT_DIR:-.}"

# 确保绝对路径可读
ABS_TARGET_DIR=$(mkdir -p "$TARGET_DIR" && cd "$TARGET_DIR" && pwd)

# --- 3. 最终确认感展示 ---
echo -e "\n${BLUE}------------------------------------------${NC}"
echo -e "  ${BOLD}项目初始化详情${NC}"
echo -e "  ${BLUE}模板:${NC} $SELECTED_TPL"
echo -e "  ${BLUE}路径:${NC} $ABS_TARGET_DIR"
echo -e "${BLUE}------------------------------------------${NC}\n"

TPL_PATH="$TEMPLATE_BASE/$SELECTED_TPL"

# --- 4. 运行 Copier ---
# 这里使用 mise x 确保 uv/copier 环境
mise x uv -- uvx --with copier copier copy --trust "$TPL_PATH" "$ABS_TARGET_DIR"

# --- 5. 自动环境初始化 ---

cd "$ABS_TARGET_DIR"

if [ -f ".mise.toml" ] || [ -f "mise.toml" ]; then
  mise trust
  echo -e "\n${BLUE}🛠️  正在安装项目所需的工具链...${NC}"
  mise install
fi

echo -e "\n${GREEN}${BOLD}✅ 项目 $SELECTED_TPL 初始化成功！${NC}"
echo -e "👉 快速开始: ${YELLOW}cd $TARGET_DIR && mise run dev${NC}\n"
