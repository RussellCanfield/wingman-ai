import SwiftUI

struct WaveView: View {
    var body: some View {
        GeometryReader { geometry in
            TimelineView(.animation) { timeline in
                let time = timeline.date.timeIntervalSinceReferenceDate
                let width = geometry.size.width
                let height = geometry.size.height
                let baseY = height * 0.85
                let amplitude = height * 0.08
                let wavelength = width / 1.2
                let phase = time * 1.8

                Canvas { context, size in
                    var path = Path()
                    path.move(to: CGPoint(x: 0, y: height))
                    path.addLine(to: CGPoint(x: 0, y: baseY))

                    var x: CGFloat = 0
                    while x <= width {
                        let sine = sin(Double(x / wavelength) * Double.pi * 2 + phase)
                        let y = baseY + amplitude * CGFloat(sine)
                        path.addLine(to: CGPoint(x: x, y: y))
                        x += 6
                    }
                    path.addLine(to: CGPoint(x: width, y: height))
                    path.closeSubpath()

                    let gradient = Gradient(colors: [
                        Color.blue.opacity(0.7),
                        Color.cyan.opacity(0.45),
                        Color.blue.opacity(0.15)
                    ])
                    context.fill(path, with: .linearGradient(
                        gradient,
                        startPoint: CGPoint(x: 0, y: baseY - amplitude),
                        endPoint: CGPoint(x: 0, y: height)
                    ))
                }
            }
        }
    }
}
