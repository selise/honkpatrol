const { Food } = require('../powerups');
const { Bird } = require('../bird');
const { Game } = require('../game');
const { Vehicle } = require('../vehicle');

// Mock assets
global.assets = {
    sounds: {
        effects: {
            poop: { play: jest.fn(), pause: jest.fn(), currentTime: 0 },
            splat: { play: jest.fn(), pause: jest.fn(), currentTime: 0 },
            powerup: { play: jest.fn(), pause: jest.fn(), currentTime: 0 }
        },
        vehicles: {
            honk_car: { play: jest.fn(), pause: jest.fn(), currentTime: 0 },
            honk_truck: { play: jest.fn(), pause: jest.fn(), currentTime: 0 },
            honk_bus: { play: jest.fn(), pause: jest.fn(), currentTime: 0 }
        }
    },
    visuals: {
        bird_flying: Array(17).fill({ width: 48, height: 48 }),
        food: {
            apple: {},
            burger: {},
            carrot: {},
            cherry: {},
            egg: {},
            fries: {},
            ham: {},
            pizza: {},
            strawberry: {},
            sushi: {},
            watermelon: {}
        },
        vehicles: {
            car_sprites: { left: [{}], right: [{}] },
            truck_sprites: { left: [{}], right: [{}] },
            bus_sprites: { left: [{}], right: [{}] }
        }
    }
};

// Mock Math.random for predictable tests
const originalMathRandom = Math.random;
let mockRandomValue = 0.5;

describe('Food Class', () => {
    const canvasWidth = 800;
    const canvasHeight = 400;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock Math.random
        Math.random = jest.fn(() => mockRandomValue);
    });
    
    afterEach(() => {
        // Restore Math.random
        Math.random = originalMathRandom;
    });
    
    test('Food initializes with random type and position', () => {
        // Force 'apple' type
        Math.random = jest.fn()
            .mockReturnValueOnce(0.0) // type index 0 -> 'apple'
            .mockReturnValueOnce(0.5) // x position
            .mockReturnValueOnce(0.5); // y position
            
        const food = new Food(canvasWidth, canvasHeight);
        
        expect(food.type).toBe('apple');
        expect(food.bellyPoints).toBe(1); // Apple should be 1 point
        expect(food.x).toBeGreaterThan(0);
        expect(food.x).toBeLessThan(canvasWidth);
        expect(food.y).toBeGreaterThan(0);
        expect(food.y).toBeLessThan(canvasHeight);
    });
    
    test('Food assigns correct belly points based on type', () => {
        // Test low value food (1 point)
        const food1 = new Food(canvasWidth, canvasHeight);
        food1.type = 'apple';
        food1.bellyPoints = food1.getBellyPoints(food1.type);
        expect(food1.bellyPoints).toBe(1);
        
        // Test medium value food (2 points)
        const food2 = new Food(canvasWidth, canvasHeight);
        food2.type = 'sushi';
        food2.bellyPoints = food2.getBellyPoints(food2.type);
        expect(food2.bellyPoints).toBe(2);
        
        // Test high value food (3 points)
        const food3 = new Food(canvasWidth, canvasHeight);
        food3.type = 'burger';
        food3.bellyPoints = food3.getBellyPoints(food3.type);
        expect(food3.bellyPoints).toBe(3);
    });
    
    test('Food despawns after lifespan expires', () => {
        const food = new Food(canvasWidth, canvasHeight);
        food.lifespan = 5; // 5 seconds
        
        // Should still be active
        expect(food.update(1)).toBe(true);
        expect(food.timeAlive).toBe(1);
        
        // Update to just before expiration
        expect(food.update(3.9)).toBe(true);
        expect(food.timeAlive).toBe(4.9);
        
        // Update to expire
        expect(food.update(0.2)).toBe(false);
        expect(food.timeAlive).toBe(5.1);
    });
    
    test('Food detects collision with bird', () => {
        const food = new Food(canvasWidth, canvasHeight);
        food.x = 400;
        food.y = 200;
        
        // Bird at same position
        const bird = {
            x: 390,
            y: 190,
            width: 48,
            height: 48
        };
        
        expect(food.checkCollision(bird)).toBe(true);
        
        // Bird far away
        const farBird = {
            x: 100,
            y: 100,
            width: 48,
            height: 48
        };
        
        expect(food.checkCollision(farBird)).toBe(false);
    });
});

// ... rest of existing tests ... 