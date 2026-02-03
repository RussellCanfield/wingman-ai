import AppKit
import SwiftUI

struct AutoHidingTextEditor: NSViewRepresentable {
    @Binding var text: String
    @Binding var shouldFocus: Bool
    var onTextChange: ((String) -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.autohidesScrollers = true
        scrollView.scrollerStyle = .overlay
        scrollView.drawsBackground = false
        scrollView.borderType = .noBorder

        let textView = NSTextView()
        textView.isEditable = true
        textView.isSelectable = true
        textView.isRichText = false
        textView.importsGraphics = false
        textView.allowsUndo = true
        textView.backgroundColor = .clear
        textView.drawsBackground = false
        textView.font = NSFont.systemFont(ofSize: 16)
        textView.textColor = .labelColor
        textView.delegate = context.coordinator
        context.coordinator.isProgrammaticUpdate = true
        textView.string = text
        context.coordinator.isProgrammaticUpdate = false
        textView.textContainerInset = NSSize(width: 2, height: 8)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.textContainer?.widthTracksTextView = true
        textView.textContainer?.containerSize = NSSize(
            width: scrollView.contentSize.width,
            height: .greatestFiniteMagnitude
        )

        scrollView.documentView = textView
        return scrollView
    }

    func updateNSView(_ nsView: NSScrollView, context: Context) {
        guard let textView = nsView.documentView as? NSTextView else { return }
        if textView.string != text {
            context.coordinator.isProgrammaticUpdate = true
            textView.string = text
            DispatchQueue.main.async {
                context.coordinator.isProgrammaticUpdate = false
            }
        }
        textView.textContainer?.containerSize = NSSize(
            width: nsView.contentSize.width,
            height: .greatestFiniteMagnitude
        )
        if shouldFocus, let window = nsView.window {
            window.makeKeyAndOrderFront(nil)
            window.makeFirstResponder(textView)
            DispatchQueue.main.async { self.shouldFocus = false }
        }
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        private let parent: AutoHidingTextEditor
        var isProgrammaticUpdate = false

        init(_ parent: AutoHidingTextEditor) {
            self.parent = parent
        }

        func textDidChange(_ notification: Notification) {
            if isProgrammaticUpdate { return }
            guard let textView = notification.object as? NSTextView else { return }
            let newText = textView.string
            if parent.text != newText {
                parent.text = newText
                parent.onTextChange?(newText)
            }
        }
    }
}
