/**
 * Represents a vehicle in the game
 * @class
 */
class Vehicle {
    /**
     * Creates a new Vehicle instance
     * @param {number} canvasWidth - Width of the game canvas
     * @param {number} canvasHeight - Height of the game canvas
     */
    constructor(canvasWidth, canvasHeight) {
        // Set canvas dimensions for reference
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        
        // Randomly select vehicle type
        const types = ['car', 'truck', 'bus', 'emergency'];
        this.type = types[Math.floor(Math.random() * types.length)];
        
        // Randomly select direction
        this.direction = Math.random() < 0.5 ? 'left' : 'right';
        
        // Select a specific sprite variant
        const spriteArray = assets.visuals.vehicles[`${this.type}_sprites`][this.direction];
        this.spriteIndex = spriteArray && spriteArray.length > 0 ? 
            Math.floor(Math.random() * spriteArray.length) : 0;
        
        // Set size based on type
        this.width = this.type === 'car' ? 80 : this.type === 'truck' ? 100 : 120;
        this.height = 50;
        
        // Set starting position based on direction
        this.y = Math.random() * (canvasHeight - 150) + 100; // Keep above ground but below sky
        if (this.direction === 'left') {
            // Start from right side, moving left
            this.x = canvasWidth + this.width / 2;
            this.speed = -(Math.random() * 100 + 50); // -150 to -50 pixels per second
        } else {
            // Start from left side, moving right
            this.x = -this.width / 2;
            this.speed = Math.random() * 100 + 50; // 50 to 150 pixels per second
        }
        
        // Set honking behavior (increased to 30% chance of honking)
        this.isHonking = Math.random() < 0.3;
        this.honkInterval = Math.random() * 3000 + 2000; // 2 to 5 seconds
        this.lastHonkTime = 0;
        this.currentlyPlayingHonk = null;
        
        // Honking animation
        this.honkAnimationTimer = 0;
    }
    
    /**
     * Updates the vehicle's position and honking state
     * @param {number} deltaTime - Time elapsed since last update in seconds
     * @returns {boolean} True if the vehicle is still on screen, false if it should be removed
     */
    update(deltaTime) {
        // Update position
        this.x += this.speed * deltaTime;
        
        // Check if vehicle is out of bounds
        if ((this.direction === 'left' && this.x < -this.width) || 
            (this.direction === 'right' && this.x > this.canvasWidth + this.width)) {
            return false; // Vehicle should be removed
        }
        
        // Handle honking
        if (this.isHonking) {
            const currentTime = Date.now();
            if (currentTime - this.lastHonkTime > this.honkInterval) {
                this.playHonkSound();
                this.lastHonkTime = currentTime;
                this.honkAnimationTimer = 0.5; // 0.5 seconds of animation
            }
            
            // Update honk animation
            if (this.honkAnimationTimer > 0) {
                this.honkAnimationTimer = Math.max(0, this.honkAnimationTimer - deltaTime);
            }
        }
        
        return true; // Vehicle is still active
    }
    
    /**
     * Plays the appropriate honk sound for this vehicle type
     */
    playHonkSound() {
        if (assets && assets.sounds && assets.sounds.vehicles) {
            // Map vehicle type to sound type
            const soundType = this.type === 'emergency' ? 'truck' : 
                             this.type === 'bus' ? 'bus' : 
                             this.type === 'truck' ? 'truck' : 'car';
                             
            const honkSound = assets.sounds.vehicles[`honk_${soundType}`];
            if (honkSound) {
                // Stop any currently playing honk
                if (this.currentlyPlayingHonk) {
                    this.currentlyPlayingHonk.pause();
                    this.currentlyPlayingHonk.currentTime = 0;
                }
                
                // Play new honk
                honkSound.currentTime = 0;
                honkSound.play();
                this.currentlyPlayingHonk = honkSound;
            }
        }
    }
    
    /**
     * Stops any currently playing honk sound
     */
    stopHonkSound() {
        if (this.currentlyPlayingHonk) {
            this.currentlyPlayingHonk.pause();
            this.currentlyPlayingHonk.currentTime = 0;
            this.currentlyPlayingHonk = null;
        }
    }
    
    /**
     * Checks if the vehicle is currently honking
     * @returns {boolean} True if honking, false otherwise
     */
    isCurrentlyHonking() {
        return this.isHonking;
    }
    
    /**
     * Draws the vehicle on the canvas
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    draw(ctx) {
        ctx.save();
        
        // Get sprite array for this vehicle type and direction
        const spriteArray = assets.visuals.vehicles[`${this.type}_sprites`][this.direction];
        
        if (spriteArray && spriteArray.length > 0) {
            // Use the consistently selected sprite index for this vehicle
            const sprite = spriteArray[Math.min(this.spriteIndex, spriteArray.length - 1)];
            
            // Draw honking indicator if honking
            if (this.isHonking) {
                // Draw speech bubble
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                
                // Draw an animated honk bubble
                const bubbleSize = this.honkAnimationTimer > 0 ? 
                    15 + Math.sin(this.honkAnimationTimer * Math.PI * 10) * 5 : 15;
                
                ctx.beginPath();
                ctx.arc(
                    this.x, 
                    this.y - this.height/2 - bubbleSize, 
                    bubbleSize, 
                    0, 
                    Math.PI * 2
                );
                ctx.fill();
                
                // Draw connecting triangle
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - this.height/2 - bubbleSize + 5);
                ctx.lineTo(this.x - 5, this.y - this.height/2);
                ctx.lineTo(this.x + 5, this.y - this.height/2);
                ctx.fill();
                
                // Draw "HONK" text
                ctx.fillStyle = '#333';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('HONK', this.x, this.y - this.height/2 - bubbleSize);
            }
            
            // Draw vehicle sprite
            ctx.drawImage(
                sprite,
                this.x - this.width/2,
                this.y - this.height/2,
                this.width,
                this.height
            );
        } else {
            // Fallback drawing
            this.drawFallback(ctx);
        }
        
        ctx.restore();
    }
    
    /**
     * Draws a fallback representation if sprites aren't available
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    drawFallback(ctx) {
        // Set color based on vehicle type
        ctx.fillStyle = this.type === 'car' ? 'blue' : 
                       this.type === 'truck' ? 'green' : 
                       this.type === 'bus' ? 'orange' : 'red';
        
        // Draw vehicle body
        ctx.fillRect(
            this.x - this.width/2,
            this.y - this.height/2,
            this.width,
            this.height
        );
        
        // Draw honking indicator if honking
        if (this.isHonking) {
            // Draw speech bubble
            ctx.fillStyle = 'white';
            
            // Draw an animated honk bubble
            const bubbleSize = this.honkAnimationTimer > 0 ? 
                15 + Math.sin(this.honkAnimationTimer * Math.PI * 10) * 5 : 15;
            
            ctx.beginPath();
            ctx.arc(
                this.x, 
                this.y - this.height/2 - bubbleSize, 
                bubbleSize, 
                0, 
                Math.PI * 2
            );
            ctx.fill();
            
            // Draw connecting triangle
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - this.height/2 - bubbleSize + 5);
            ctx.lineTo(this.x - 5, this.y - this.height/2);
            ctx.lineTo(this.x + 5, this.y - this.height/2);
            ctx.fill();
            
            // Draw "HONK" text
            ctx.fillStyle = 'black';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('HONK', this.x, this.y - this.height/2 - bubbleSize);
        }
    }
    
    /**
     * Checks if a dropping has collided with this vehicle
     * @param {Object} dropping - The dropping object with x, y, width, height properties
     * @returns {boolean} True if collision detected, false otherwise
     */
    checkCollision(dropping) {
        if (!dropping) return false;
        
        // Simple bounding box collision detection
        return (
            this.x - this.width/2 < dropping.x + dropping.width/2 &&
            this.x + this.width/2 > dropping.x - dropping.width/2 &&
            this.y - this.height/2 < dropping.y + dropping.height/2 &&
            this.y + this.height/2 > dropping.y - dropping.height/2
        );
    }
    
    /**
     * Handles what happens when this vehicle is hit by a dropping
     * @returns {number} Score value based on whether the vehicle was honking
     */
    handleHit() {
        const wasHonking = this.isHonking;
        
        // Stop honking
        this.stopHonkSound();
        this.isHonking = false;
        
        // Return score based on whether the vehicle was honking
        return wasHonking ? 10 : -5;
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Vehicle };
} 