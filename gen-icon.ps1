Add-Type -AssemblyName System.Drawing
$code = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;

public static class IconGen
{
    public static void Run(string path)
    {
        using (var bmp = new Bitmap(1024, 1024))
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;

            var rect = new Rectangle(0, 0, 1024, 1024);
            using (var brush = new LinearGradientBrush(rect,
                Color.FromArgb(255, 245, 158, 11),
                Color.FromArgb(255, 180, 83, 9), 45f))
            {
                g.FillEllipse(brush, rect);
            }

            var glowRect = new Rectangle(60, 60, 520, 520);
            using (var glow = new LinearGradientBrush(glowRect,
                Color.FromArgb(100, 255, 255, 255),
                Color.FromArgb(0, 255, 255, 255), 45f))
            {
                g.FillEllipse(glow, glowRect);
            }

            string linChar = "\u6797";
            using (var font = new Font("Microsoft YaHei", 460f, FontStyle.Bold))
            {
                var sf = new StringFormat();
                sf.Alignment = StringAlignment.Center;
                sf.LineAlignment = StringAlignment.Center;

                var shadowRect = new RectangleF(6, 6, 1024, 1024);
                using (var shadowBrush = new SolidBrush(Color.FromArgb(80, 0, 0, 0)))
                    g.DrawString(linChar, font, shadowBrush, shadowRect, sf);

                var textRect = new RectangleF(0, 0, 1024, 1024);
                g.DrawString(linChar, font, Brushes.White, textRect, sf);
            }

            bmp.Save(path, ImageFormat.Png);
        }
    }
}
'@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
[IconGen]::Run((Join-Path (Get-Location) 'app-icon.png'))
Write-Output 'OK app-icon.png'
