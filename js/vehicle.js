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
        
        // Define lanes
        this.totalLanes = 6; // Total number of lanes on the road (including emergency lanes)
        this.laneHeight = 60; // Height of each lane
        this.laneStartY = 100; // Starting Y position of first lane
        
        // Assign a lane from the central 3 lanes (lanes 2-4, index 1-3)
        // Keeping lanes 0 and 5 as emergency lanes and not using lane 4 (bottom regular lane)
        this.lane = Math.floor(Math.random() * 3) + 1;
        
        // Set Y position based on lane
        this.y = this.laneStartY + (this.lane * this.laneHeight) + (this.laneHeight / 2);
        
        // Set starting position based on direction
        if (this.direction === 'left') {
            // Start from right side, moving left
            this.x = canvasWidth + this.width / 2;
            this.speed = -(Math.random() * 100 + 50); // -150 to -50 pixels per second
        } else {
            // Start from left side, moving right
            this.x = -this.width / 2;
            this.speed = Math.random() * 100 + 50; // 50 to 150 pixels per second
        }
        
        // Store original speed for returning to normal speed after slowdown
        this.originalSpeed = this.speed;
        // Target speed for smooth acceleration/deceleration
        this.targetSpeed = this.speed;
        // Speed change rate (pixels per second per second)
        this.acceleration = 100;
        // Flag to track if vehicle is in slowdown mode
        this.isSlowingDown = false;
        
        // Collision and crash state
        this.hasCrashed = false;
        this.crashTimer = 0;
        this.crashDuration = 5; // 5 seconds until removal after crash
        this.fire = null; // Will hold a Fire instance when crashed
        
        // Collision avoidance
        this.isChangingLane = false;
        this.laneChangeProgress = 0;
        this.targetLane = this.lane;
        this.laneChangeSpeed = 1.5; // Time in seconds to complete a lane change
        this.originalY = this.y;
        this.targetY = this.y;
        
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
     * @param {Array<Vehicle>} allVehicles - All vehicles in the game for collision checking
     * @returns {boolean} True if the vehicle is still on screen, false if it should be removed
     */
    update(deltaTime, allVehicles) {
        // If vehicle has crashed, update fire and crash timer
        if (this.hasCrashed) {
            // Update fire animation
            if (this.fire) {
                // Fire returns false when its duration is exceeded
                if (!this.fire.update(deltaTime)) {
                    return false; // Remove vehicle
                }
            } else {
                // If no fire exists but vehicle is crashed, increment crash timer
                this.crashTimer += deltaTime;
                if (this.crashTimer >= this.crashDuration) {
                    return false; // Remove vehicle
                }
            }
            
            return true; // Keep crashed vehicle until fire is gone
        }
        
        // Update speed (smooth acceleration/deceleration)
        if (this.speed !== this.targetSpeed) {
            const speedDiff = this.targetSpeed - this.speed;
            const speedChangeThisFrame = Math.min(
                Math.abs(speedDiff), 
                this.acceleration * deltaTime
            ) * Math.sign(speedDiff);
            
            this.speed += speedChangeThisFrame;
            
            // Snap to target speed if very close to avoid floating point issues
            if (Math.abs(this.speed - this.targetSpeed) < 1) {
                this.speed = this.targetSpeed;
            }
        }
        
        // Update position
        this.x += this.speed * deltaTime;
        
        // Check if vehicle is out of bounds
        if ((this.direction === 'left' && this.x < -this.width) || 
            (this.direction === 'right' && this.x > this.canvasWidth + this.width)) {
            return false; // Vehicle should be removed
        }
        
        // Handle lane changes if in progress
        if (this.isChangingLane) {
            this.laneChangeProgress += deltaTime / this.laneChangeSpeed;
            if (this.laneChangeProgress >= 1) {
                // Lane change complete
                this.lane = this.targetLane;
                this.y = this.targetY;
                this.isChangingLane = false;
                this.laneChangeProgress = 0;
                
                // If we were slowing down and now lane change is complete,
                // check if we can return to normal speed
                if (this.isSlowingDown) {
                    // Check if the collision risk is gone
                    this.checkIfCanReturnToNormalSpeed(allVehicles);
                }
            } else {
                // Interpolate position between lanes
                this.y = this.originalY + (this.targetY - this.originalY) * this.laneChangeProgress;
            }
        } else if (allVehicles) {
            // Check for potential collisions with other vehicles
            this.detectAndAvoidCollisions(allVehicles, deltaTime);
            
            // If we're slowing down but not changing lanes, check if we can return to normal speed
            if (this.isSlowingDown && !this.isChangingLane) {
                this.checkIfCanReturnToNormalSpeed(allVehicles);
            }
            
            // Check for actual collisions with other vehicles
            this.checkForVehicleCollisions(allVehicles);
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
     * Detects potential collisions with other vehicles and initiates lane changes to avoid them
     * @param {Array<Vehicle>} allVehicles - All vehicles in the game
     * @param {number} deltaTime - Time elapsed since last update in seconds
     */
    detectAndAvoidCollisions(allVehicles, deltaTime) {
        // Don't check if already changing lanes
        if (this.isChangingLane) return;
        
        // Check for vehicles in the same lane going in the opposite direction
        const oppositeDirectionVehicles = allVehicles.filter(vehicle => 
            vehicle !== this && 
            vehicle.lane === this.lane && 
            ((this.direction === 'left' && vehicle.direction === 'right') || 
             (this.direction === 'right' && vehicle.direction === 'left'))
        );
        
        // Check for vehicles in the same lane going in the same direction
        const sameDirectionVehicles = allVehicles.filter(vehicle => 
            vehicle !== this && 
            vehicle.lane === this.lane && 
            this.direction === vehicle.direction
        );
        
        // Check for collisions with opposite direction vehicles first
        for (const vehicle of oppositeDirectionVehicles) {
            // Calculate time to collision
            const timeToCollision = this.calculateTimeToCollision(vehicle);
            
            // If vehicles are about to collide, slow down and attempt lane change
            if (timeToCollision !== null) {
                if (timeToCollision < 3) { // Start slowing down earlier, at 3 seconds
                    // Start slowing down
                    this.slowDown();
                    
                    // If closer than 2 seconds, attempt lane change
                    if (timeToCollision < 2) {
                        this.attemptLaneChange(allVehicles, true); // true indicates opposing traffic
                    }
                    
                    return; // Exit after handling the first potential collision
                }
            }
        }
        
        // If no opposite direction collisions, check same direction
        for (const vehicle of sameDirectionVehicles) {
            // For same direction, simple distance check
            const distance = this.direction === 'right' 
                ? vehicle.x - this.x  // If going right, check vehicles ahead
                : this.x - vehicle.x; // If going left, check vehicles ahead
                
            // Only consider vehicles ahead of us
            if (distance > 0 && distance < this.width * 4) { // Increased detection distance
                // Start slowing down
                this.slowDown();
                
                // If very close, attempt lane change
                if (distance < this.width * 2) {
                    this.attemptLaneChange(allVehicles, false); // false indicates same direction traffic
                }
                
                return;
            }
        }
    }
    
    /**
     * Slows the vehicle down to a random percentage between 5% and 30% of its original speed
     */
    slowDown() {
        this.isSlowingDown = true;
        // Generate a random percentage between 5% and 30%
        const randomSlowdownPercentage = (Math.random() * 25 + 5) / 100; // 0.05 to 0.30
        // Set target speed to the random percentage of original speed (keeping the sign)
        this.targetSpeed = this.originalSpeed * randomSlowdownPercentage;
    }
    
    /**
     * Checks if the vehicle can return to normal speed after a slowdown
     * @param {Array<Vehicle>} allVehicles - All vehicles in the game
     */
    checkIfCanReturnToNormalSpeed(allVehicles) {
        // Check if there are any vehicles that would cause us to remain slowed down
        
        // Check for vehicles in the same lane going in the opposite direction
        const oppositeDirectionVehicles = allVehicles.filter(vehicle => 
            vehicle !== this && 
            vehicle.lane === this.lane && 
            ((this.direction === 'left' && vehicle.direction === 'right') || 
             (this.direction === 'right' && vehicle.direction === 'left'))
        );
        
        // Check for vehicles in the same lane going in the same direction
        const sameDirectionVehicles = allVehicles.filter(vehicle => 
            vehicle !== this && 
            vehicle.lane === this.lane && 
            this.direction === vehicle.direction
        );
        
        // Check for potential collisions
        let shouldRemainSlowed = false;
        
        // Check opposite direction
        for (const vehicle of oppositeDirectionVehicles) {
            const timeToCollision = this.calculateTimeToCollision(vehicle);
            if (timeToCollision !== null && timeToCollision < 3) {
                shouldRemainSlowed = true;
                break;
            }
        }
        
        // Check same direction
        if (!shouldRemainSlowed) {
            for (const vehicle of sameDirectionVehicles) {
                const distance = this.direction === 'right' 
                    ? vehicle.x - this.x
                    : this.x - vehicle.x;
                    
                if (distance > 0 && distance < this.width * 4) {
                    shouldRemainSlowed = true;
                    break;
                }
            }
        }
        
        // If no collision risks, return to normal speed
        if (!shouldRemainSlowed) {
            this.isSlowingDown = false;
            this.targetSpeed = this.originalSpeed;
        }
    }
    
    /**
     * Calculates time to collision with another vehicle
     * @param {Vehicle} otherVehicle - The other vehicle to check against
     * @returns {number|null} Time in seconds until collision, or null if no collision is expected
     */
    calculateTimeToCollision(otherVehicle) {
        // Ensure vehicles are approaching each other
        const approachingFromLeft = this.direction === 'right' && otherVehicle.direction === 'left' && this.x < otherVehicle.x;
        const approachingFromRight = this.direction === 'left' && otherVehicle.direction === 'right' && this.x > otherVehicle.x;
        
        if (!approachingFromLeft && !approachingFromRight) {
            return null; // Vehicles are not approaching each other
        }
        
        // Calculate distance between vehicles
        const distance = Math.abs(this.x - otherVehicle.x) - (this.width / 2) - (otherVehicle.width / 2);
        
        // Calculate relative speed (closing speed)
        const relativeSpeed = Math.abs(this.speed) + Math.abs(otherVehicle.speed);
        
        // Calculate time to collision
        if (relativeSpeed > 0 && distance > 0) {
            return distance / relativeSpeed;
        }
        
        return null; // No collision expected
    }
    
    /**
     * Attempts to change lanes to avoid a collision
     * @param {Array<Vehicle>} allVehicles - All vehicles in the game for checking lane availability
     * @param {boolean} isOpposingTraffic - Whether the lane change is triggered by opposing traffic
     */
    attemptLaneChange(allVehicles, isOpposingTraffic) {
        // Identify adjacent lanes, including emergency lanes in critical situations
        const adjacentLanes = [];
        const includeEmergencyLanes = this.isEmergencySituation(allVehicles);
        
        // Add lane above (including emergency lane 0 if critical)
        if (this.lane > 1) {
            adjacentLanes.push(this.lane - 1); // Normal lane above
        }
        if (includeEmergencyLanes && this.lane === 1) {
            adjacentLanes.push(0); // Emergency lane (top)
        }
        
        // Add lane below, including lane 4 (restricted) and emergency lane 5 if critical
        if (this.lane < 3) {
            adjacentLanes.push(this.lane + 1); // Normal lane below
        }
        if (this.lane === 3) {
            // Lane 4 (restricted) is available for lane changes (not spawning)
            adjacentLanes.push(4);
        }
        if (includeEmergencyLanes && this.lane === 4) {
            adjacentLanes.push(5); // Emergency lane (bottom)
        }
        
        // If no adjacent lanes available, exit
        if (adjacentLanes.length === 0) return;
        
        // Filter to available lanes (no vehicles within safety distance)
        const availableLanes = adjacentLanes.filter(lane => this.isLaneClear(lane, allVehicles));
        
        // If there are available lanes, select one based on direction and traffic type
        if (availableLanes.length > 0) {
            let targetLane;
            
            if (isOpposingTraffic) {
                // For opposing traffic, use directional preference
                if (this.direction === 'right') { // Cars coming from left
                    // Prefer moving up (-50%)
                    const upperLanes = availableLanes.filter(lane => lane < this.lane);
                    if (upperLanes.length > 0) {
                        targetLane = upperLanes[Math.floor(Math.random() * upperLanes.length)];
                    } else {
                        targetLane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
                    }
                } else { // Cars coming from right
                    // Prefer moving down (50%)
                    const lowerLanes = availableLanes.filter(lane => lane > this.lane);
                    if (lowerLanes.length > 0) {
                        targetLane = lowerLanes[Math.floor(Math.random() * lowerLanes.length)];
                    } else {
                        targetLane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
                    }
                }
            } else {
                // For same direction traffic, random selection as before
                targetLane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
            }
            
            // Initiate lane change
            this.startLaneChange(targetLane);
        }
    }
    
    /**
     * Determines if this is an emergency situation warranting the use of emergency lanes
     * @param {Array<Vehicle>} allVehicles - All vehicles in the game
     * @returns {boolean} True if emergency lanes should be considered
     */
    isEmergencySituation(allVehicles) {
        // Check for imminent collisions (less than 1 second away)
        const oppositeDirectionVehicles = allVehicles.filter(vehicle => 
            vehicle !== this && 
            vehicle.lane === this.lane && 
            ((this.direction === 'left' && vehicle.direction === 'right') || 
             (this.direction === 'right' && vehicle.direction === 'left'))
        );
        
        for (const vehicle of oppositeDirectionVehicles) {
            const timeToCollision = this.calculateTimeToCollision(vehicle);
            // If collision is imminent (less than 1 second), it's an emergency
            if (timeToCollision !== null && timeToCollision < 1) {
                return true;
            }
        }
        
        // Check for extremely close same-direction vehicles
        const sameDirectionVehicles = allVehicles.filter(vehicle => 
            vehicle !== this && 
            vehicle.lane === this.lane && 
            this.direction === vehicle.direction
        );
        
        for (const vehicle of sameDirectionVehicles) {
            const distance = this.direction === 'right' 
                ? vehicle.x - this.x
                : this.x - vehicle.x;
                
            // If vehicle is extremely close (less than width), it's an emergency
            if (distance > 0 && distance < this.width) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Checks if a lane is clear of other vehicles within a safety distance
     * @param {number} lane - The lane to check
     * @param {Array<Vehicle>} allVehicles - All vehicles in the game
     * @returns {boolean} True if the lane is safe to move into
     */
    isLaneClear(lane, allVehicles) {
        const safetyDistance = this.width * 2; // Safety distance is twice the vehicle width
        
        // Check if any vehicles are too close in the target lane
        return !allVehicles.some(vehicle => 
            vehicle !== this && 
            vehicle.lane === lane && 
            Math.abs(vehicle.x - this.x) < safetyDistance
        );
    }
    
    /**
     * Starts a lane change maneuver to the target lane
     * @param {number} targetLane - The lane to change to
     */
    startLaneChange(targetLane) {
        this.isChangingLane = true;
        this.targetLane = targetLane;
        this.laneChangeProgress = 0;
        this.originalY = this.y;
        this.targetY = this.laneStartY + (targetLane * this.laneHeight) + (this.laneHeight / 2);
    }
    
    /**
     * Plays the appropriate honk sound for this vehicle type
     */
    playHonkSound() {
        if (assets && assets.sounds && assets.sounds.vehicles) {
            // Map vehicle type to possible sound types
            const possibleSounds = this.type === 'emergency' ? ['truck'] : 
                                 this.type === 'bus' ? ['bus'] : 
                                 this.type === 'truck' ? ['truck'] : 
                                 ['car', 'old', 'sports']; // For regular cars, randomly choose from different honk sounds
                                 
            // Randomly select a sound type from the possible options
            const soundType = possibleSounds[Math.floor(Math.random() * possibleSounds.length)];
            const honkSound = assets.sounds.vehicles[`honk_${soundType}`];
            
            if (honkSound) {
                // Stop any currently playing honk
                if (this.currentlyPlayingHonk) {
                    this.currentlyPlayingHonk.pause();
                    this.currentlyPlayingHonk.currentTime = 0;
                }
                
                // Play new honk with error handling for autoplay restriction
                honkSound.currentTime = 0;
                try {
                    honkSound.play().catch(err => {
                        // Silently fail if autoplay is blocked
                        console.debug('Honk sound autoplay blocked:', err);
                    });
                    this.currentlyPlayingHonk = honkSound;
                } catch (err) {
                    // Silently fail if play() throws an error
                    console.debug('Honk sound play failed:', err);
                }
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
     * Checks for collisions with other vehicles
     * @param {Array<Vehicle>} allVehicles - All vehicles in the game
     */
    checkForVehicleCollisions(allVehicles) {
        // Skip if already crashed
        if (this.hasCrashed) return;
        
        // Check for collisions with other non-crashed vehicles
        for (const otherVehicle of allVehicles) {
            // Skip self-comparison and already crashed vehicles
            if (otherVehicle === this || otherVehicle.hasCrashed) continue;
            
            // Simple bounding box collision detection
            const collision = 
                this.x - this.width/2 < otherVehicle.x + otherVehicle.width/2 &&
                this.x + this.width/2 > otherVehicle.x - otherVehicle.width/2 &&
                this.y - this.height/2 < otherVehicle.y + otherVehicle.height/2 &&
                this.y + this.height/2 > otherVehicle.y - otherVehicle.height/2;
                
            if (collision) {
                // If moving in opposite directions, check speeds
                const isOppositeDirection = 
                    (this.direction === 'left' && otherVehicle.direction === 'right') ||
                    (this.direction === 'right' && otherVehicle.direction === 'left');
                
                // Check if both vehicles are moving slow enough to pass through each other
                // Slow is defined as less than 30% of original speed (in absolute terms)
                const thisIsSlow = Math.abs(this.speed) < Math.abs(this.originalSpeed) * 0.3;
                const otherIsSlow = Math.abs(otherVehicle.speed) < Math.abs(otherVehicle.originalSpeed) * 0.3;
                
                // If both are slow, or moving in same direction, allow them to pass through
                if ((thisIsSlow && otherIsSlow) || !isOppositeDirection) {
                    // Just pass through each other (ghosting)
                    continue;
                } else {
                    // Trigger crash for both vehicles
                    this.crash();
                    otherVehicle.crash();
                }
                
                break; // Only handle one collision at a time
            }
        }
    }
    
    /**
     * Triggers a crash state for this vehicle
     */
    crash() {
        // Only crash if not already crashed
        if (this.hasCrashed) return;
        
        // Set crash flags and stop the vehicle
        this.hasCrashed = true;
        this.speed = 0;
        this.targetSpeed = 0;
        this.crashTimer = 0;
        
        // Log information about fire sprites
        const fireSprites = assets.visuals.vehicles.fire_sprites;
        console.log(`Vehicle crash: Creating fire with ${fireSprites ? fireSprites.length : 0} sprites from /assets/visuals/vehicles/fire_sprites`);
        
        // Create fire animation at vehicle position
        this.fire = new Fire(
            this.x,               // X position
            this.y,               // Y position
            this.width * 1.5,     // Width
            this.height * 1.8,    // Height
            this.crashDuration    // Duration
        );
        
        // Stop any honking
        if (this.isHonking) {
            this.stopHonkSound();
            this.isHonking = false;
        }
    }
    
    /**
     * Draws the vehicle on the canvas
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    draw(ctx) {
        ctx.save();
        
        // Draw vehicle sprite
        this.drawVehicleSprite(ctx);
        
        // Draw fire if crashed
        if (this.hasCrashed && this.fire) {
            this.fire.draw(ctx);
        }
        
        ctx.restore();
    }
    
    /**
     * Draws the vehicle sprite
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    drawVehicleSprite(ctx) {
        // Get sprite array for this vehicle type and direction
        const spriteArray = assets.visuals.vehicles[`${this.type}_sprites`][this.direction];
        
        if (spriteArray && spriteArray.length > 0 && this.spriteIndex < spriteArray.length) {
            // Draw vehicle sprite
            const sprite = spriteArray[this.spriteIndex];
            
            if (sprite) {
                // Draw the vehicle with optional honking animation
                if (this.honkAnimationTimer > 0) {
                    // When honking, make the vehicle "bounce" a little
                    const bounceY = Math.sin(this.honkAnimationTimer * Math.PI * 10) * 2;
                    ctx.drawImage(sprite, this.x - this.width/2, this.y - this.height/2 + bounceY, this.width, this.height);
                    
                    // Draw honking bubble
                    this.drawHonkBubble(ctx);
                } else {
                    ctx.drawImage(sprite, this.x - this.width/2, this.y - this.height/2, this.width, this.height);
                }
            } else {
                // Fallback if sprite is null
                this.drawFallback(ctx);
            }
        } else {
            // Fallback drawing
            this.drawFallback(ctx);
        }
    }
    
    /**
     * Draws the honk speech bubble
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    drawHonkBubble(ctx) {
        // Draw speech bubble
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        
        // Draw an animated honk bubble
        const bubbleSize = 15 + Math.sin(this.honkAnimationTimer * Math.PI * 10) * 5;
        
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
    
    /**
     * Draws a fallback vehicle when sprite is not available
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    drawFallback(ctx) {
        ctx.save();
        
        // Use subtle, semi-transparent colors instead of bright solid colors
        const baseColor = this.type === 'car' ? 'rgba(70, 130, 180, 0.8)' :  // Steel blue for cars
                         this.type === 'truck' ? 'rgba(119, 136, 153, 0.8)' : // Slate gray for trucks
                         this.type === 'bus' ? 'rgba(160, 82, 45, 0.8)' :    // Sienna for buses
                         'rgba(178, 34, 34, 0.8)';                          // Firebrick for emergency
        
        // Create a gradient for a more natural look
        const gradient = ctx.createLinearGradient(
            this.x - this.width/2, this.y, 
            this.x + this.width/2, this.y
        );
        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(0.5, this.adjustColor(baseColor, 30)); // Lighter in middle
        gradient.addColorStop(1, baseColor);
        
        ctx.fillStyle = gradient;
        
        // Draw rounded vehicle body
        ctx.beginPath();
        const radius = 8; // Rounded corners
        
        // Draw rounded rectangle
        const x = this.x - this.width/2;
        const y = this.y - this.height/2;
        const width = this.width;
        const height = this.height;
        
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        
        // Add a subtle shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 2;
        
        ctx.fill();
        
        // Add details (windows, etc.)
        this.drawVehicleDetails(ctx);
        
        // Draw honking indicator if honking
        if (this.isHonking) {
            this.drawHonkBubble(ctx);
        }
        
        ctx.restore();
    }
    
    /**
     * Draws details on the fallback vehicle
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    drawVehicleDetails(ctx) {
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        
        // Draw windshield and windows
        ctx.fillStyle = 'rgba(200, 220, 240, 0.7)'; // Light blue tint for glass
        
        // Windshield position depends on direction
        const frontPosition = this.direction === 'right' ? 
            this.x + this.width/2 - this.width/5 :
            this.x - this.width/2 + this.width/5;
            
        // Draw windshield (front)
        ctx.fillRect(
            frontPosition - this.width/10,
            this.y - this.height/3,
            this.width/5,
            this.height/2
        );
        
        // Draw headlights
        ctx.fillStyle = 'rgba(255, 255, 200, 0.8)';
        const headlightY = this.y + this.height/5;
        const headlightSize = this.width/12;
        
        if (this.direction === 'right') {
            // Right-facing headlight
            ctx.beginPath();
            ctx.arc(
                this.x + this.width/2 - headlightSize/2,
                headlightY,
                headlightSize,
                0,
                Math.PI * 2
            );
            ctx.fill();
        } else {
            // Left-facing headlight
            ctx.beginPath();
            ctx.arc(
                this.x - this.width/2 + headlightSize/2,
                headlightY,
                headlightSize,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    }
    
    /**
     * Utility function to adjust color brightness
     * @param {string} color - Color in rgba format
     * @param {number} amount - Amount to adjust brightness
     * @returns {string} Adjusted color
     */
    adjustColor(color, amount) {
        // Parse the rgba color
        const rgba = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)/);
        if (!rgba) return color;
        
        let r = parseInt(rgba[1]) + amount;
        let g = parseInt(rgba[2]) + amount;
        let b = parseInt(rgba[3]) + amount;
        
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
        
        const a = rgba[4] || "1";
        
        return `rgba(${r}, ${g}, ${b}, ${a})`;
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