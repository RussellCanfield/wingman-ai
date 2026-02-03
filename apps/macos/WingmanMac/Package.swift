// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "WingmanMac",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "WingmanMacKit",
            targets: ["WingmanMacKit"]
        ),
    ],
    targets: [
        .target(
            name: "WingmanMacKit",
            path: "Sources/WingmanMac",
            resources: [
                .process("Resources")
            ]
        ),
        .testTarget(
            name: "WingmanMacTests",
            dependencies: ["WingmanMacKit"],
            path: "Tests/WingmanMacTests"
        )
    ]
)
