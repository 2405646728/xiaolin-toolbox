# 生成 NSIS 安装器品牌图片（BMP 格式）- 精美版
# header.bmp: 150x57 顶部品牌条
# sidebar.bmp: 164x314 侧边品牌图
# 设计风格：深色玻璃 + 绿色霓虹光晕 + 渐变光斑 + 几何装饰

Add-Type -AssemblyName System.Drawing

$outDir = "D:\Casual work\Completed project\vpn\src-tauri\nsis-resources"

# 颜色定义
$bg = [System.Drawing.Color]::FromArgb(10, 11, 13)         # #0A0B0D base-950
$bg2 = [System.Drawing.Color]::FromArgb(18, 20, 26)        # 渐变中间
$bg3 = [System.Drawing.Color]::FromArgb(26, 29, 36)        # #1A1D24
$accent = [System.Drawing.Color]::FromArgb(50, 240, 140)   # #32F08C emerald 主色
$accentDim = [System.Drawing.Color]::FromArgb(30, 160, 95) # 暗绿色
$white = [System.Drawing.Color]::FromArgb(245, 247, 250)   # 暖白
$gray = [System.Drawing.Color]::FromArgb(170, 178, 190)    # 银灰
$dim = [System.Drawing.Color]::FromArgb(110, 120, 135)     # 暗灰
$lineColor = [System.Drawing.Color]::FromArgb(40, 48, 58)  # 分隔线
$fontFamily = "Microsoft YaHei UI"

# ============================================================
# header.bmp 150x57 - 顶部品牌条
# ============================================================
$hBmp = New-Object System.Drawing.Bitmap 150, 57
$hg = [System.Drawing.Graphics]::FromImage($hBmp)
$hg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$hg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$hg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# 背景渐变（横向深色）
$hRect = New-Object System.Drawing.Rectangle 0, 0, 150, 57
$hBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $hRect, $bg, $bg3, 0
$hg.FillRectangle($hBrush, $hRect)
$hBrush.Dispose()

# 右侧绿色光晕（径向渐变）
$glowRect = New-Object System.Drawing.Rectangle 100, -10, 80, 80
$glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowPath.AddEllipse($glowRect)
$glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $glowPath
$glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(60, $accent)
$glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $accent))
$hg.FillEllipse($glowBrush, $glowRect)
$glowBrush.Dispose()
$glowPath.Dispose()

# 左侧绿色渐变竖条（霓虹光带）
$barRect = New-Object System.Drawing.Rectangle 0, 0, 4, 57
$barBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $barRect, $accent, $accentDim, 90
$hg.FillRectangle($barBrush, $barRect)
$barBrush.Dispose()

# 品牌名（大字）
$hFont = New-Object System.Drawing.Font $fontFamily, 16, ([System.Drawing.FontStyle]::Bold)
$hBrush2 = New-Object System.Drawing.SolidBrush $white
$hg.DrawString("小林 AI", $hFont, $hBrush2, 14, 11)

# 副标题（小字 + 字距）
$hFont2 = New-Object System.Drawing.Font $fontFamily, 7.5
$hBrush3 = New-Object System.Drawing.SolidBrush $gray
$format = New-Object System.Drawing.StringFormat
$hg.DrawString("AI  ·  桌面助手", $hFont2, $hBrush3, 16, 36)

$hg.Dispose()
$hBmp.Save("$outDir\header.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$hBmp.Dispose()
Write-Host "Generated header.bmp (150x57)"

# ============================================================
# sidebar.bmp 164x314 - 侧边品牌图（主视觉）
# ============================================================
$sBmp = New-Object System.Drawing.Bitmap 164, 314
$sg = [System.Drawing.Graphics]::FromImage($sBmp)
$sg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$sg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# 背景三段渐变（顶部深 → 中部稍亮 → 底部深）
$sRect = New-Object System.Drawing.Rectangle 0, 0, 164, 314
$sBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $sRect, $bg, $bg3, 90
$sg.FillRectangle($sBrush, $sRect)
$sBrush.Dispose()

# 顶部绿色光晕（径向，模拟氛围光斑）
$topGlowRect = New-Object System.Drawing.Rectangle 20, -40, 124, 124
$topGlowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$topGlowPath.AddEllipse($topGlowRect)
$topGlowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $topGlowPath
$topGlowBrush.CenterColor = [System.Drawing.Color]::FromArgb(45, $accent)
$topGlowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $accent))
$sg.FillEllipse($topGlowBrush, $topGlowRect)
$topGlowBrush.Dispose()
$topGlowPath.Dispose()

# 底部右侧小光晕
$botGlowRect = New-Object System.Drawing.Rectangle 80, 250, 100, 100
$botGlowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$botGlowPath.AddEllipse($botGlowRect)
$botGlowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $botGlowPath
$botGlowBrush.CenterColor = [System.Drawing.Color]::FromArgb(25, $accent)
$botGlowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $accent))
$sg.FillEllipse($botGlowBrush, $botGlowRect)
$botGlowBrush.Dispose()
$botGlowPath.Dispose()

# 顶部 logo：两个错位绿色方块（带发光效果）
$logoX = 62
$logoY = 78
$logoSize = 20
$gap = 2
# 阴影发光层（更大、半透明）
$shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, $accent))
$sg.FillRectangle($shadowBrush, $logoX - 3, $logoY - 3, $logoSize + 6, $logoSize + 6)
$sg.FillRectangle($shadowBrush, $logoX + $logoSize + $gap - 3, $logoY - 3, $logoSize + 6, $logoSize + 6)
$shadowBrush.Dispose()
# 主方块（渐变）
$block1Rect = New-Object System.Drawing.Rectangle $logoX, $logoY, $logoSize, $logoSize
$block1Brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $block1Rect, $accent, $accentDim, 90
$sg.FillRectangle($block1Brush, $block1Rect)
$block1Brush.Dispose()
$block2Rect = New-Object System.Drawing.Rectangle ($logoX + $logoSize + $gap), $logoY, $logoSize, $logoSize
$block2Brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $block2Rect, $accent, $accentDim, 90
$sg.FillRectangle($block2Brush, $block2Rect)
$block2Brush.Dispose()

# 品牌名（大号粗体）
$sFont = New-Object System.Drawing.Font $fontFamily, 22, ([System.Drawing.FontStyle]::Bold)
$sBrush = New-Object System.Drawing.SolidBrush $white
$sg.DrawString("小林 AI", $sFont, $sBrush, 33, 110)

# 副标题
$sFont2 = New-Object System.Drawing.Font $fontFamily, 10
$sBrush2 = New-Object System.Drawing.SolidBrush $accent
$sg.DrawString("AI 桌面助手", $sFont2, $sBrush2, 52, 145)

# 分隔线（细横线 + 两端渐隐）
$lineY = 175
$lineBrush = New-Object System.Drawing.SolidBrush $lineColor
$sg.FillRectangle($lineBrush, 35, $lineY, 94, 1)
$lineBrush.Dispose()

# 功能列表（带绿色圆点前缀）
$dotFont = New-Object System.Drawing.Font $fontFamily, 9
$dotBrush = New-Object System.Drawing.SolidBrush $accent
$textFont = New-Object System.Drawing.Font $fontFamily, 8.5
$textBrush = New-Object System.Drawing.SolidBrush $gray
$features = @(
  @{ y = 195; text = "对话式 AI 助手" },
  @{ y = 213; text = "自主操控电脑" },
  @{ y = 231; text = "70+ 实用功能" },
  @{ y = 249; text = "液态玻璃设计" }
)
foreach ($f in $features) {
  # 绿色圆点
  $sg.FillEllipse($dotBrush, 38, $f.y + 3, 5, 5)
  # 文字
  $sg.DrawString($f.text, $textFont, $textBrush, 50, $f.y)
}

# 底部分隔线
$botLineBrush = New-Object System.Drawing.SolidBrush $lineColor
$sg.FillRectangle($botLineBrush, 35, 278, 94, 1)
$botLineBrush.Dispose()

# 底部公司信息（两行）
$sFont4 = New-Object System.Drawing.Font $fontFamily, 8, ([System.Drawing.FontStyle]::Bold)
$sBrush4 = New-Object System.Drawing.SolidBrush $gray
$sg.DrawString("XiaoLin Studio", $sFont4, $sBrush4, 45, 290)
$sFont5 = New-Object System.Drawing.Font $fontFamily, 7
$sBrush5 = New-Object System.Drawing.SolidBrush $dim
$sg.DrawString("Copyright (c) 2026", $sFont5, $sBrush5, 50, 303)

# 左边缘绿色光带（呼应 header）
$edgeRect = New-Object System.Drawing.Rectangle 0, 0, 2, 314
$edgeBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $edgeRect, $accent, $accentDim, 90
$sg.FillRectangle($edgeBrush, $edgeRect)
$edgeBrush.Dispose()

$sg.Dispose()
$sBmp.Save("$outDir\sidebar.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$sBmp.Dispose()
Write-Host "Generated sidebar.bmp (164x314)"

Write-Host "Done. Files at: $outDir"
