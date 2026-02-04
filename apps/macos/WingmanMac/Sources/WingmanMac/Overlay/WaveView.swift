import SwiftUI

struct WaveView: View {
    var body: some View {
        GeometryReader { geometry in
            TimelineView(.animation) { timeline in
                let time = timeline.date.timeIntervalSinceReferenceDate
                let width = geometry.size.width
                let height = geometry.size.height
                let intensity = 0.5 + 0.5 * sin(time * 0.9)
                let baseLift = height * (0.04 + 0.04 * intensity)
                let wavelength = max(160, width / 1.3)

                Canvas { context, size in
                    func flamePath(amplitude: CGFloat, baseY: CGFloat, phase: Double) -> Path {
                        var path = Path()
                        path.move(to: CGPoint(x: 0, y: height))
                        path.addLine(to: CGPoint(x: 0, y: baseY))

                        var x: CGFloat = 0
                        while x <= width {
                            let primary = sin(Double(x / wavelength) * Double.pi * 2 + phase)
                            let secondary = sin(Double(x / (wavelength * 0.6)) * Double.pi * 2 - phase * 1.1)
                            let detail = sin(Double(x / (wavelength * 0.35)) * Double.pi * 2 + phase * 1.7)
                            let combined = (primary * 0.55 + secondary * 0.3 + detail * 0.15)
                            let spike = pow(abs(combined), 1.35)
                            let flameHeight = (0.35 + 0.65 * spike) * (0.85 + 0.25 * intensity)
                            let jitter = CGFloat(combined) * amplitude * 0.08
                            let y = baseY - amplitude * CGFloat(flameHeight) + jitter
                            path.addLine(to: CGPoint(x: x, y: y))
                            x += 8
                        }
                        path.addLine(to: CGPoint(x: width, y: height))
                        path.closeSubpath()
                        return path
                    }

                    let outerBase = height * 0.92 - baseLift
                    let midBase = height * 0.9 - baseLift * 1.15
                    let innerBase = height * 0.88 - baseLift * 1.35

                    let outer = flamePath(amplitude: height * 0.22, baseY: outerBase, phase: time * 1.2)
                    let mid = flamePath(amplitude: height * 0.18, baseY: midBase, phase: time * 1.6)
                    let inner = flamePath(amplitude: height * 0.14, baseY: innerBase, phase: time * 2.1)

                    context.drawLayer { layer in
                        layer.addFilter(.blur(radius: 14))
                        layer.fill(
                            outer,
                            with: .linearGradient(
                                Gradient(colors: [
                                    Color.blue.opacity(0.35),
                                    Color.cyan.opacity(0.2),
                                    Color.clear
                                ]),
                                startPoint: CGPoint(x: 0, y: innerBase - height * 0.2),
                                endPoint: CGPoint(x: 0, y: height)
                            )
                        )
                    }

                    context.drawLayer { layer in
                        layer.addFilter(.blur(radius: 6))
                        layer.fill(
                            mid,
                            with: .linearGradient(
                                Gradient(colors: [
                                    Color.blue.opacity(0.55),
                                    Color.cyan.opacity(0.35),
                                    Color.blue.opacity(0.15)
                                ]),
                                startPoint: CGPoint(x: 0, y: innerBase - height * 0.18),
                                endPoint: CGPoint(x: 0, y: height)
                            )
                        )
                    }

                    context.drawLayer { layer in
                        layer.blendMode = .plusLighter
                        layer.fill(
                            inner,
                            with: .linearGradient(
                                Gradient(colors: [
                                    Color.cyan.opacity(0.75),
                                    Color.blue.opacity(0.45),
                                    Color.clear
                                ]),
                                startPoint: CGPoint(x: 0, y: innerBase - height * 0.16),
                                endPoint: CGPoint(x: 0, y: height)
                            )
                        )
                    }
                }
            }
        }
    }
}
