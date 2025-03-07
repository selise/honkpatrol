Asset Structure Documentation
=======================

This document outlines the organization and contents of the game assets.

/assets
├── sounds/
│   ├── effects/
│   │   ├── poop.wav         # Sound effect for bird dropping
│   │   ├── powerup.wav      # Power-up collection sound
│   │   ├── explosion.mp3    # Explosion effect
│   │   └── splat.wav        # Impact/splat sound effect
│   │
│   ├── ui/
│   │   ├── start.wav        # Game start sound
│   │   ├── gameover.wav     # Game over sound
│   │   └── click.wav        # UI button click sound
│   │
│   └── vehicles/
│       ├── honk_old.wav     # Classic car horn sound
│       ├── honk_sports.wav  # Sports car horn sound
│       ├── honk_bus.wav     # Bus horn sound
│       ├── honk_truck.wav   # Truck horn sound
│       └── honk_car.wav     # Standard car horn sound
│
└── visuals/
    ├── bird_flying/         # Bird animation sequence
    │   └── skeleton-01_fly_[00-16].png  # 17 frames of bird flying animation
    │
    └── vehicles/
        ├── car_sprites/     # Regular car sprites
        │   ├── car_left_[XX].png    # Cars facing left
        │   └── car_right_[XX].png   # Cars facing right
        │
        ├── bus_sprites/     # Bus vehicle sprites
        │   ├── bus_left_[XX].png    # Buses facing left
        │   └── bus_right_[XX].png   # Buses facing right
        │
        ├── truck_sprites/   # Truck vehicle sprites
        │   ├── truck_left_[XX].png  # Trucks facing left
        │   └── truck_right_[XX].png # Trucks facing right
        │
        └── emergency_sprites/  # Emergency vehicle sprites
            ├── emergency_left_[XX].png   # Emergency vehicles facing left
            └── emergency_right_[XX].png  # Emergency vehicles facing right

File Formats:
------------
- Sound files: .wav and .mp3 formats
- Image files: .png format (all sprites and animations)

Notes:
------
1. Bird Animation:
   - Complete flying animation sequence with 17 frames
   - Frames are numbered from 00 to 16
   - Consistent sprite size for smooth animation

2. Vehicle Sprites:
   - All vehicles have both left and right-facing variants
   - Sequential numbering system for easy animation
   - Separate folders for different vehicle types for better organization

3. Sound Effects:
   - Vehicle sounds are separated by vehicle type
   - UI sounds for game state changes and interactions
   - Effect sounds for gameplay actions

Usage:
------
- Animation frames can be loaded sequentially for smooth animations
- Vehicle sprites are organized by direction for easy access
- Sound effects are categorized by their use case (UI, vehicles, effects) 