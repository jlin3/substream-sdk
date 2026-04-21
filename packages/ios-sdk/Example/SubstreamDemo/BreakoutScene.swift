import SpriteKit

/// A Breakout-style SpriteKit scene. Mirrors the canvas game used by the web
/// SDK demo, so iOS + web demos feel like the same app.
final class BreakoutScene: SKScene, SKPhysicsContactDelegate {

    private let paddle = SKShapeNode(rectOf: CGSize(width: 120, height: 16), cornerRadius: 8)
    private let ball = SKShapeNode(circleOfRadius: 10)
    private var bricks: [SKShapeNode] = []
    private let scoreLabel = SKLabelNode(fontNamed: "Menlo-Bold")
    private var score = 0

    private let paddleCategory: UInt32 = 1 << 0
    private let ballCategory: UInt32 = 1 << 1
    private let brickCategory: UInt32 = 1 << 2
    private let edgeCategory: UInt32 = 1 << 3

    override func didMove(to view: SKView) {
        backgroundColor = .black
        physicsWorld.contactDelegate = self
        physicsWorld.gravity = .zero

        let border = SKPhysicsBody(edgeLoopFrom: frame)
        border.categoryBitMask = edgeCategory
        physicsBody = border

        setupPaddle()
        setupBall()
        setupBricks()
        setupScore()
    }

    private func setupPaddle() {
        paddle.fillColor = .white
        paddle.position = CGPoint(x: frame.midX, y: 60)
        paddle.physicsBody = SKPhysicsBody(rectangleOf: CGSize(width: 120, height: 16))
        paddle.physicsBody?.isDynamic = false
        paddle.physicsBody?.categoryBitMask = paddleCategory
        paddle.physicsBody?.contactTestBitMask = ballCategory
        addChild(paddle)
    }

    private func setupBall() {
        ball.fillColor = .cyan
        ball.position = CGPoint(x: frame.midX, y: frame.midY)
        ball.physicsBody = SKPhysicsBody(circleOfRadius: 10)
        ball.physicsBody?.restitution = 1.0
        ball.physicsBody?.friction = 0
        ball.physicsBody?.linearDamping = 0
        ball.physicsBody?.angularDamping = 0
        ball.physicsBody?.allowsRotation = false
        ball.physicsBody?.categoryBitMask = ballCategory
        ball.physicsBody?.contactTestBitMask = paddleCategory | brickCategory
        ball.physicsBody?.velocity = CGVector(dx: 220, dy: 220)
        addChild(ball)
    }

    private func setupBricks() {
        let columns = 8
        let rows = 5
        let spacing: CGFloat = 4
        let availableWidth = frame.width - CGFloat(columns + 1) * spacing
        let brickWidth = availableWidth / CGFloat(columns)
        let brickHeight: CGFloat = 18

        for row in 0..<rows {
            for col in 0..<columns {
                let brick = SKShapeNode(
                    rectOf: CGSize(width: brickWidth, height: brickHeight),
                    cornerRadius: 3
                )
                let hue = CGFloat(row) / CGFloat(rows)
                brick.fillColor = UIColor(hue: hue, saturation: 0.85, brightness: 0.95, alpha: 1)
                brick.strokeColor = .black
                brick.position = CGPoint(
                    x: spacing + brickWidth / 2 + CGFloat(col) * (brickWidth + spacing),
                    y: frame.maxY - 80 - CGFloat(row) * (brickHeight + spacing)
                )
                brick.physicsBody = SKPhysicsBody(rectangleOf: brick.frame.size)
                brick.physicsBody?.isDynamic = false
                brick.physicsBody?.categoryBitMask = brickCategory
                brick.physicsBody?.contactTestBitMask = ballCategory
                addChild(brick)
                bricks.append(brick)
            }
        }
    }

    private func setupScore() {
        scoreLabel.fontSize = 24
        scoreLabel.fontColor = .white
        scoreLabel.position = CGPoint(x: frame.midX, y: frame.maxY - 40)
        scoreLabel.text = "Score: 0"
        addChild(scoreLabel)
    }

    // MARK: Input

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        let location = touch.location(in: self)
        paddle.position.x = max(70, min(frame.maxX - 70, location.x))
    }

    // MARK: Contact

    func didBegin(_ contact: SKPhysicsContact) {
        let bodies = [contact.bodyA, contact.bodyB]
        if let brickBody = bodies.first(where: { $0.categoryBitMask == brickCategory }),
            let brick = brickBody.node as? SKShapeNode
        {
            brick.removeFromParent()
            score += 10
            scoreLabel.text = "Score: \(score)"
        }
    }
}
