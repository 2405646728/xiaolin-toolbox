// Gooey 液体融合 SVG 滤镜：让水滴与按钮边缘产生"拉丝融合分离"的液态效果
// 在应用根处渲染一次即可，通过 filter: url(#liquid-goo) 引用

export function LiquidFilter() {
  return (
    <svg className="absolute h-0 w-0" aria-hidden>
      <defs>
        {/* 主 gooey 滤镜：高斯模糊 + 亮度阈值，制造液体融合边缘 */}
        <filter id="liquid-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
        {/* 弱 gooey：用于按钮轻微变形，避免过度糊化 */}
        <filter id="liquid-soft">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
}
