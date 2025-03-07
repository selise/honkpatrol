const { Bird } = require('../bird');
const { Vehicle } = require('../vehicle');

// Mock assets for testing
global.assets = {
    sounds: {
        effects: {
            poop: { play: jest.fn(), currentTime: 0 },
            splat: { play: jest.fn(), currentTime: 0 }
        },
        vehicles: {
            honk_car: { play: jest.fn(), currentTime: 0 }
        }
    },
    visuals: {
        droppings: {},
        bird_flying: Array(17).fill({ width: 64, height: 64 }),
        vehicles: {
            car_sprites: { left: [{}], right: [{}] }
        }
    }
};

describe('Bird Keyboard Movement', () => {
    let bird;
    const canvasWidth = 800;
    const canvasHeight = 400;

    beforeEach(() => {
        bird = new Bird(400, 200, canvasWidth, canvasHeight);
        // Reset mock function calls
        jest.clearAllMocks();
    });

    test('Bird moves left when left arrow is pressed', () => {
        const initialX = bird.x;
        bird.startMovingLeft();
        bird.update(0.1); // 100ms
        expect(bird.x).toBeLessThan(initialX);
    });

    test('Bird moves right when right arrow is pressed', () => {
        const initialX = bird.x;
        bird.startMovingRight();
        bird.update(0.1); // 100ms
        expect(bird.x).toBeGreaterThan(initialX);
    });

    test('Bird moves up when up arrow is pressed', () => {
        const initialY = bird.y;
        bird.startMovingUp();
        bird.update(0.1); // 100ms
        expect(bird.y).toBeLessThan(initialY);
    });

    test('Bird moves down when down arrow is pressed', () => {
        const initialY = bird.y;
        bird.startMovingDown();
        bird.update(0.1); // 100ms
        expect(bird.y).toBeGreaterThan(initialY);
    });

    test('Bird stops moving when key is released', () => {
        // Move right
        bird.startMovingRight();
        bird.update(0.1);
        const positionAfterMoving = bird.x;
        
        // Stop moving right
        bird.stopMovingRight();
        bird.update(0.1);
        
        // Position should not change after stopping
        expect(bird.x).toBe(positionAfterMoving);
    });

    test('Bird moves diagonally when multiple keys are pressed', () => {
        const initialX = bird.x;
        const initialY = bird.y;
        
        bird.startMovingRight();
        bird.startMovingDown();
        bird.update(0.1);
        
        expect(bird.x).toBeGreaterThan(initialX);
        expect(bird.y).toBeGreaterThan(initialY);
    });

    test('Bird stays within canvas boundaries', () => {
        // Try to move beyond left edge
        bird.x = 10;
        bird.startMovingLeft();
        bird.update(1); // Large time step to ensure boundary reached
        expect(bird.x).toBeGreaterThanOrEqual(0);
        
        // Try to move beyond right edge
        bird.x = canvasWidth - 10;
        bird.startMovingRight();
        bird.update(1);
        expect(bird.x).toBeLessThanOrEqual(canvasWidth - bird.width);
        
        // Try to move beyond top edge
        bird.y = 10;
        bird.startMovingUp();
        bird.update(1);
        expect(bird.y).toBeGreaterThanOrEqual(0);
        
        // Try to move beyond bottom edge
        bird.y = canvasHeight - 10;
        bird.startMovingDown();
        bird.update(1);
        expect(bird.y).toBeLessThanOrEqual(canvasHeight - bird.height);
    });
});

describe('Bird Dropping Mechanics', () => {
    let bird;

    beforeEach(() => {
        bird = new Bird(400, 200, 800, 400);
        // Reset mock function calls
        jest.clearAllMocks();
    });

    test('Bird can create a dropping', () => {
        const dropping = bird.drop();
        expect(dropping).toBeTruthy();
        expect(dropping.x).toBe(bird.x + bird.width / 2);
        expect(dropping.y).toBe(bird.y + bird.height / 2);
        expect(assets.sounds.effects.poop.play).toHaveBeenCalled();
    });

    test('Bird cannot create multiple droppings simultaneously', () => {
        const firstDrop = bird.drop();
        const secondDrop = bird.drop();
        expect(firstDrop).toBeTruthy();
        expect(secondDrop).toBeNull();
    });

    test('Dropping moves downward', () => {
        bird.drop();
        const initialY = bird.getActiveDropping().y;
        bird.update(0.1);
        expect(bird.getActiveDropping().y).toBeGreaterThan(initialY);
    });

    test('Dropping is removed when it goes off screen', () => {
        bird.drop();
        // Position dropping near bottom of screen
        bird.activeDropping.y = 390;
        // Update to move dropping below screen
        bird.update(0.1);
        expect(bird.getActiveDropping()).toBeNull();
    });
});

describe('Vehicle Hit Detection', () => {
    let bird;
    let vehicle;
    let droppings = [];

    beforeEach(() => {
        bird = new Bird(400, 200, 800, 400);
        vehicle = new Vehicle('car', 400, 300, 'left');
        droppings = [];
    });

    test('Dropping hits honking vehicle increases score', () => {
        let score = 0;
        
        // Make vehicle honk
        vehicle.startHonking();
        
        // Create dropping directly above vehicle
        const dropping = {
            x: vehicle.x,
            y: vehicle.y - 20,
            width: 10,
            height: 10,
            speed: 300
        };
        droppings.push(dropping);
        
        // Update dropping position
        const deltaTime = 0.1;
        dropping.y += dropping.speed * deltaTime;
        
        // Check for collision
        if (vehicle.checkHit(dropping)) {
            score += vehicle.getState().isHonking ? 10 : -5;
            droppings = droppings.filter(d => d !== dropping);
        }
        
        expect(score).toBe(10);
        expect(droppings.length).toBe(0);
        expect(vehicle.isHit).toBe(true);
    });

    test('Dropping hits non-honking vehicle decreases score', () => {
        let score = 0;
        
        // Ensure vehicle is not honking
        vehicle.isHonking = false;
        
        // Create dropping directly above vehicle
        const dropping = {
            x: vehicle.x,
            y: vehicle.y - 20,
            width: 10,
            height: 10,
            speed: 300
        };
        droppings.push(dropping);
        
        // Update dropping position
        const deltaTime = 0.1;
        dropping.y += dropping.speed * deltaTime;
        
        // Check for collision
        if (vehicle.checkHit(dropping)) {
            score += vehicle.getState().isHonking ? 10 : -5;
            droppings = droppings.filter(d => d !== dropping);
        }
        
        expect(score).toBe(-5);
        expect(droppings.length).toBe(0);
        expect(vehicle.isHit).toBe(true);
    });
}); 