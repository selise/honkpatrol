const { Game } = require('../game');
const { Bird } = require('../bird');
const { Vehicle } = require('../vehicle');

// Mock assets for testing
global.assets = {
    sounds: {
        effects: {
            poop: { play: jest.fn(), pause: jest.fn(), currentTime: 0 },
            splat: { play: jest.fn(), pause: jest.fn(), currentTime: 0 },
            explosion: { play: jest.fn(), pause: jest.fn(), currentTime: 0 },
            powerup: { play: jest.fn(), pause: jest.fn(), currentTime: 0 }
        },
        ui: {
            start: { play: jest.fn(), pause: jest.fn(), currentTime: 0 },
            gameover: { play: jest.fn(), pause: jest.fn(), currentTime: 0 },
            click: { play: jest.fn(), pause: jest.fn(), currentTime: 0 }
        },
        vehicles: {
            honk_car: { play: jest.fn(), pause: jest.fn(), currentTime: 0 },
            honk_truck: { play: jest.fn(), pause: jest.fn(), currentTime: 0 },
            honk_bus: { play: jest.fn(), pause: jest.fn(), currentTime: 0 }
        }
    },
    visuals: {
        bird_flying: Array(17).fill({ width: 48, height: 48 }),
        vehicles: {
            car_sprites: { left: [{}], right: [{}] },
            bus_sprites: { left: [{}], right: [{}] },
            truck_sprites: { left: [{}], right: [{}] },
            emergency_sprites: { left: [{}], right: [{}] }
        }
    }
};

// Mock Vehicle and Bird classes
jest.mock('../vehicle', () => {
    return {
        Vehicle: jest.fn().mockImplementation(() => ({
            update: jest.fn(() => true),
            draw: jest.fn(),
            checkCollision: jest.fn(() => false),
            handleHit: jest.fn(() => 10),
            isHonking: true,
            playHonkSound: jest.fn(),
            lastHonkTime: 0
        }))
    };
});

jest.mock('../bird', () => {
    return {
        Bird: jest.fn().mockImplementation(() => ({
            update: jest.fn(),
            draw: jest.fn(),
            getActiveDropping: jest.fn(() => null),
            removeDropping: jest.fn(),
            drop: jest.fn(),
            getPosition: jest.fn(() => ({ x: 400, y: 200 })),
            getPowerUpState: jest.fn(() => ({ 
                powerUpLevel: 0, 
                poopSize: 10, 
                poopCooldown: 1, 
                splashRadius: 0 
            }))
        }))
    };
});

describe('Game Scoring System', () => {
    let game;
    let mockCanvas;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock canvas and context
        mockCanvas = {
            width: 800,
            height: 400,
            getContext: jest.fn(() => ({
                fillRect: jest.fn(),
                beginPath: jest.fn(),
                arc: jest.fn(),
                fill: jest.fn(),
                save: jest.fn(),
                restore: jest.fn(),
                fillText: jest.fn(),
                drawImage: jest.fn(),
                stroke: jest.fn()
            }))
        };
        
        // Create game instance
        game = new Game(mockCanvas);
    });
    
    test('Game initializes with score of 0 and wave 1', () => {
        expect(game.score).toBe(0);
        expect(game.wave).toBe(1);
        expect(game.vehiclesPerWave).toBe(5);
    });
    
    test('Score increases when hitting a honking vehicle', () => {
        // Create a mock vehicle that is honking
        const honkingVehicle = {
            checkCollision: jest.fn(() => true),
            handleHit: jest.fn(() => 10),
            isHonking: true
        };
        
        // Add the vehicle to the game
        game.vehicles.push(honkingVehicle);
        
        // Create a mock dropping
        const dropping = {
            x: 400,
            y: 300,
            width: 10,
            height: 10,
            speed: 300,
            splashRadius: 0
        };
        
        // Add the dropping to the game
        game.droppings.push(dropping);
        
        // Update the game which should detect the collision
        game.update(0.1);
        
        // Verify score increased by 10
        expect(game.score).toBe(10);
        expect(honkingVehicle.handleHit).toHaveBeenCalled();
    });
    
    test('Score decreases when hitting a non-honking vehicle', () => {
        // Create a mock vehicle that is not honking
        const nonHonkingVehicle = {
            checkCollision: jest.fn(() => true),
            handleHit: jest.fn(() => -5),
            isHonking: false
        };
        
        // Add the vehicle to the game
        game.vehicles.push(nonHonkingVehicle);
        
        // Create a mock dropping
        const dropping = {
            x: 400,
            y: 300,
            width: 10,
            height: 10,
            speed: 300,
            splashRadius: 0
        };
        
        // Add the dropping to the game
        game.droppings.push(dropping);
        
        // Update the game which should detect the collision
        game.update(0.1);
        
        // Verify score decreased by 5
        expect(game.score).toBe(-5);
        expect(nonHonkingVehicle.handleHit).toHaveBeenCalled();
    });
    
    test('Score cannot go below 0', () => {
        // Set initial score to 3
        game.score = 3;
        
        // Create a mock vehicle that is not honking
        const nonHonkingVehicle = {
            checkCollision: jest.fn(() => true),
            handleHit: jest.fn(() => -5),
            isHonking: false
        };
        
        // Add the vehicle to the game
        game.vehicles.push(nonHonkingVehicle);
        
        // Create a mock dropping
        const dropping = {
            x: 400,
            y: 300,
            width: 10,
            height: 10,
            speed: 300,
            splashRadius: 0
        };
        
        // Add the dropping to the game
        game.droppings.push(dropping);
        
        // Update the game which should detect the collision
        game.update(0.1);
        
        // Verify score is clamped at 0
        expect(game.score).toBe(0);
        expect(nonHonkingVehicle.handleHit).toHaveBeenCalled();
    });
});

describe('Game Wave Progression', () => {
    let game;
    let mockCanvas;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock canvas and context
        mockCanvas = {
            width: 800,
            height: 400,
            getContext: jest.fn(() => ({
                fillRect: jest.fn(),
                beginPath: jest.fn(),
                arc: jest.fn(),
                fill: jest.fn(),
                save: jest.fn(),
                restore: jest.fn(),
                fillText: jest.fn(),
                drawImage: jest.fn(),
                stroke: jest.fn()
            }))
        };
        
        // Create game instance
        game = new Game(mockCanvas);
        
        // Spy on vehicle spawning
        jest.spyOn(game, 'spawnVehicle');
    });
    
    afterEach(() => {
        if (game.spawnVehicle.mockRestore) {
            game.spawnVehicle.mockRestore();
        }
    });
    
    test('Wave increments after wave duration', () => {
        // Advance time to just before wave end
        game.update(game.waveDuration - 0.1);
        expect(game.wave).toBe(1);
        
        // Advance time past wave end
        game.update(0.2);
        expect(game.wave).toBe(2);
        expect(game.vehiclesPerWave).toBe(7); // 5 + 2
        expect(game.waveTimer).toBe(0); // Timer reset
    });
    
    test('Vehicle spawn interval decreases with each wave', () => {
        // Wave 1 interval
        const wave1Interval = game.getVehicleSpawnInterval();
        expect(wave1Interval).toBe(2); // Base interval
        
        // Set to wave 2
        game.wave = 2;
        const wave2Interval = game.getVehicleSpawnInterval();
        expect(wave2Interval).toBe(1.8); // 2.0 - (2-1)*0.2
        
        // Set to wave 5
        game.wave = 5;
        const wave5Interval = game.getVehicleSpawnInterval();
        expect(wave5Interval).toBe(1.2); // 2.0 - (5-1)*0.2
        
        // Set to wave 10 (should cap at 1.0)
        game.wave = 10;
        const wave10Interval = game.getVehicleSpawnInterval();
        expect(wave10Interval).toBe(1.0); // Min cap
    });
    
    test('Vehicles per wave increases by 2 with each wave', () => {
        expect(game.vehiclesPerWave).toBe(5); // Wave 1
        
        // Advance to wave 2
        game.startNewWave();
        expect(game.wave).toBe(2);
        expect(game.vehiclesPerWave).toBe(7);
        
        // Advance to wave 3
        game.startNewWave();
        expect(game.wave).toBe(3);
        expect(game.vehiclesPerWave).toBe(9);
    });
    
    test('Wave advances when all vehicles are spawned and cleared', () => {
        // Set up a situation where all vehicles are spawned but none remain
        game.vehiclesSpawned = game.vehiclesPerWave;
        game.vehicles = [];
        
        // Update should advance the wave
        game.update(0.1);
        
        expect(game.wave).toBe(2);
        expect(game.vehiclesSpawned).toBe(0); // Reset for next wave
    });
    
    test('Spawns correct number of vehicles per wave', () => {
        // Spawn all vehicles for wave 1
        for (let i = 0; i < game.vehiclesPerWave; i++) {
            game.vehicleSpawnTimer = game.getVehicleSpawnInterval();
            game.update(0.1);
        }
        
        expect(game.vehiclesSpawned).toBe(5);
        expect(game.spawnVehicle).toHaveBeenCalledTimes(5);
        
        // Attempt to spawn one more (should not spawn because max reached)
        game.vehicleSpawnTimer = game.getVehicleSpawnInterval();
        game.update(0.1);
        
        expect(game.vehiclesSpawned).toBe(5); // Still 5
        expect(game.spawnVehicle).toHaveBeenCalledTimes(5); // Still 5 calls
    });
});

// Export for integration with test runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { gameTests: true };
} 