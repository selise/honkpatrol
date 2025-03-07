/**
 * Manages game powerups and their effects
 * @class
 */
class PowerupManager {
    constructor() {
        // To be implemented
    }
}

/**
 * Represents a food item that can be consumed by the bird for power-ups
 * @class
 */
class Food {
    /**
     * Creates a new Food instance
     * @param {number} canvasWidth - Width of the game canvas
     * @param {number} canvasHeight - Height of the game canvas
     */
    constructor(canvasWidth, canvasHeight) {
        // Set canvas dimensions for reference
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        
        // Available food types from the assets folder
        const types = [
            'apple', 'burger', 'carrot', 'cherry', 'egg', 
            'fries', 'ham', 'pizza', 'strawberry', 'sushi', 'watermelon'
        ];
        
        // Randomly select food type
        this.type = types[Math.floor(Math.random() * types.length)];
        
        // Set belly points based on type
        this.bellyPoints = this.getBellyPoints(this.type);
        
        // Set size based on type (can be adjusted based on sprite dimensions)
        this.width = 30;
        this.height = 30;
        
        // Set random position (keeping away from edges)
        this.x = Math.random() * (canvasWidth - 100) + 50;
        this.y = Math.random() * (canvasHeight - 100) + 50;
        
        // Set lifespan for despawning if not consumed
        this.lifespan = 15; // seconds
        this.timeAlive = 0;
        
        // Visual effect properties
        this.bobAmount = 5; // pixels to bob up and down
        this.bobSpeed = 2; // seconds per bob cycle
        this.bobTimer = 0;
    }
    
    /**
     * Determines belly points based on food type
     * @param {string} type - The type of food
     * @returns {number} The number of belly points this food provides
     */
    getBellyPoints(type) {
        // Group foods by nutritional value
        const lowValue = ['apple', 'carrot', 'cherry', 'strawberry', 'watermelon']; // 1 point
        const mediumValue = ['egg', 'fries', 'ham', 'sushi']; // 2 points
        const highValue = ['burger', 'pizza']; // 3 points
        
        if (lowValue.includes(type)) return 1;
        if (mediumValue.includes(type)) return 2;
        if (highValue.includes(type)) return 3;
        
        return 1; // Default fallback
    }
    
    /**
     * Updates the food's state
     * @param {number} deltaTime - Time elapsed since last update in seconds
     * @returns {boolean} True if the food is still active, false if it should be removed
     */
    update(deltaTime) {
        // Update lifespan
        this.timeAlive += deltaTime;
        if (this.timeAlive >= this.lifespan) {
            return false; // Food should be removed
        }
        
        // Update bob animation
        this.bobTimer += deltaTime;
        
        return true; // Food is still active
    }
    
    /**
     * Draws the food on the canvas
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    draw(ctx) {
        ctx.save();
        
        // Apply bobbing effect
        const bobOffset = Math.sin((this.bobTimer / this.bobSpeed) * Math.PI * 2) * this.bobAmount;
        
        // Draw food sprite if available
        if (assets && assets.visuals && assets.visuals.food && assets.visuals.food[this.type]) {
            ctx.drawImage(
                assets.visuals.food[this.type],
                this.x - this.width/2,
                this.y - this.height/2 + bobOffset,
                this.width,
                this.height
            );
        } else {
            // Fallback drawing
            this.drawFallback(ctx, bobOffset);
        }
        
        // Draw remaining time indicator (fades out as lifespan decreases)
        const remainingLifePercent = 1 - (this.timeAlive / this.lifespan);
        ctx.fillStyle = `rgba(255, 255, 255, ${remainingLifePercent * 0.5})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.height/2 - 10 + bobOffset, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    /**
     * Draws a fallback representation if sprites aren't available
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     * @param {number} bobOffset - Vertical offset for bobbing animation
     */
    drawFallback(ctx, bobOffset) {
        // Group foods by color
        const greenFoods = ['apple', 'carrot', 'watermelon'];
        const redFoods = ['cherry', 'strawberry'];
        const yellowFoods = ['egg', 'fries'];
        const brownFoods = ['burger', 'ham'];
        const whiteFoods = ['sushi'];
        const orangeFoods = ['pizza'];
        
        // Set color based on food type
        if (greenFoods.includes(this.type)) {
            ctx.fillStyle = 'green';
        } else if (redFoods.includes(this.type)) {
            ctx.fillStyle = 'red';
        } else if (yellowFoods.includes(this.type)) {
            ctx.fillStyle = 'yellow';
        } else if (brownFoods.includes(this.type)) {
            ctx.fillStyle = 'brown';
        } else if (whiteFoods.includes(this.type)) {
            ctx.fillStyle = 'white';
        } else if (orangeFoods.includes(this.type)) {
            ctx.fillStyle = 'orange';
        } else {
            ctx.fillStyle = 'purple'; // Default fallback
        }
        
        // Draw a circle for all food types as a simple fallback
        ctx.beginPath();
        ctx.arc(this.x, this.y + bobOffset, this.width/2, 0, Math.PI * 2);
        ctx.fill();
        
        // Add text label (first letter of food type)
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type.charAt(0).toUpperCase(), this.x, this.y + bobOffset);
    }
    
    /**
     * Checks if the bird has collided with this food
     * @param {Object} bird - The bird object with x, y, width, height properties
     * @returns {boolean} True if collision detected, false otherwise
     */
    checkCollision(bird) {
        if (!bird) return false;
        
        // Simple bounding box collision detection
        return (
            this.x - this.width/2 < bird.x + bird.width &&
            this.x + this.width/2 > bird.x &&
            this.y - this.height/2 < bird.y + bird.height &&
            this.y + this.height/2 > bird.y
        );
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PowerupManager, Food };
} 