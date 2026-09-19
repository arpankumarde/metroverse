# DELHI METRO 3D SIMULATOR
## Product + Technical Blueprint

Build a polished, immersive, first-person 3D Delhi Metro simulator.

The experience should feel like the player is physically sitting/standing inside a Delhi Metro train and travelling through the network.

This is NOT a code visualization, metro map application, or generic train game.

The primary experience is:

**"I am inside a Delhi Metro train."**

---

# 1. CORE EXPERIENCE

The player starts inside a realistic-looking Delhi Metro coach.

The camera is first-person.

The player can:

- Look left/right/up/down using the mouse.
- Rotate the camera smoothly with mouse movement.
- Look around freely inside the train.
- Look through the windows.
- See passengers.
- See the station platform when stopped.
- Watch the environment move outside while travelling.
- Hear station announcements.
- See the next station on digital displays.
- Travel between stations.
- Exit the train at interchange stations.
- Walk through an interchange.
- Board another Metro line.
- Experience the new line's train/environment.
- Open a Metro map to understand the current journey.

The experience should prioritize immersion over menus.

---

# 2. TECHNOLOGY

Preferred stack:

Frontend / 3D:

- React
- Three.js
- React Three Fiber
- @react-three/drei

Build with WebGL.

Use Vite for development.

Use TypeScript.

Use a clean component architecture.

Suggested structure:

src/
  components/
  scenes/
  train/
  stations/
  passengers/
  world/
  metro/
  ui/
  audio/
  systems/
  data/

---

# 3. CAMERA

The camera must be FIRST PERSON.

Do NOT use a third-person character.

The player should feel like their eyes are inside the train.

Camera requirements:

- PerspectiveCamera
- Smooth mouse look
- Horizontal rotation
- Vertical rotation
- Clamp vertical rotation to prevent unnatural flipping
- Smooth camera movement
- Subtle head movement
- Very subtle train vibration
- Optional subtle camera shake when the train accelerates/brakes

Mouse controls:

Move mouse → camera looks around.

The player should be able to:

LOOK LEFT
LOOK RIGHT
LOOK UP
LOOK DOWN

The player should NOT need to drag a UI joystick.

Desktop experience should use pointer-lock style controls.

Click the scene to enter immersive mouse-look mode.

ESC exits pointer lock.

---

# 4. PLAYER POSITION

Start the player seated or standing inside the train.

Recommended MVP:

Player is seated near a window.

This is important because the player can look:

FORWARD
LEFT
RIGHT
OUTSIDE THE WINDOW
DOWN AT THE FLOOR
UP AT THE TRAIN DISPLAY

The player should have a natural eye height.

Do not make the camera float unnaturally.

---

# 5. TRAIN INTERIOR

Create a believable Delhi Metro-style coach.

Include:

- Seats
- Handrails
- Vertical poles
- Doors
- Windows
- Ceiling
- LED lights
- Digital passenger information display
- Route map
- Emergency signage
- Door warning lights
- Floor
- Interior advertisements
- Passengers

The interior does not need perfect real-world photogrammetry.

Prioritize:

- believable proportions
- lighting
- materials
- recognizable Metro design
- clean geometry
- performance

Use modular geometry.

For example:

TrainCoach.tsx
TrainDoor.tsx
TrainSeat.tsx
TrainWindow.tsx
TrainPole.tsx
TrainDisplay.tsx
TrainRouteMap.tsx

---

# 6. TRAIN WINDOWS

Windows are extremely important.

When the train is travelling:

The player should see the world moving outside.

Do not simply teleport between stations.

The train should visibly travel.

Outside the window:

- tunnels
- station platforms
- buildings
- roads
- trees
- lights
- bridges
- Delhi skyline
- underground sections
- elevated sections

Use different environments depending on the route.

---

# 7. TRAIN MOVEMENT

Implement a train movement system.

The train should have states:

IDLE
DOORS_OPEN
DOORS_CLOSING
DEPARTING
ACCELERATING
CRUISING
BRAKING
ARRIVING
STOPPED

Example journey:

DOORS_OPEN
↓
announcement
↓
doors close
↓
train starts moving
↓
acceleration
↓
cruising
↓
approaching station
↓
braking
↓
train stops
↓
doors open

Movement should be smooth.

Do not instantly teleport the train between stations.

---

# 8. STATION SYSTEM

Each station should contain:

- Platform
- Platform edge
- Station signs
- Station name
- Lighting
- Pillars
- Benches
- Passengers
- Signage
- Train stopping position

When arriving:

1. Train slows down.
2. Platform becomes visible through the window.
3. Train aligns with platform.
4. Train stops.
5. Announcement plays.
6. Doors open.
7. Passengers leave/enter.
8. Doors close.
9. Train departs.

---

# 9. DELHI METRO NETWORK

Create a data-driven Metro network.

Do not hard-code station logic into components.

Create a metro network data model.

Example:

const stations = [
  {
    id: "rajiv-chowk",
    name: "Rajiv Chowk",
    lines: ["blue", "yellow"],
    type: "interchange"
  }
]

Lines should contain ordered stations.

Example:

BLUE_LINE:
Dwarka
...
Rajiv Chowk
...
Noida Sector 18

YELLOW_LINE:
Samaypur Badli
...
Rajiv Chowk
...
Hauz Khas
...

Start with a limited number of stations for the MVP.

Prioritize:

- Rajiv Chowk
- Mandi House
- Yamuna Bank
- Noida Sector 15
- Noida Sector 16
- Noida Sector 18

Also create a second line for demonstrating interchange.

The architecture must allow additional stations to be added simply by modifying data.

---

# 10. METRO LINE COLORS

Each Metro line has its own color.

Example:

Blue Line → blue

Yellow Line → yellow

Red Line → red

Violet Line → violet

Magenta Line → magenta

Pink Line → pink

When the player changes trains:

The visual identity of the journey should change.

For example:

Blue Line:

- Blue route indicator
- Blue train UI
- Blue map
- Blue station indicators

After changing to Yellow Line:

- Yellow route indicator
- Yellow map
- Yellow train indicator
- Yellow journey UI

---

# 11. INTERCHANGE EXPERIENCE

This is a major feature.

Do NOT simply switch the train's color.

At an interchange station:

The player should be able to leave the train.

Example:

Rajiv Chowk.

Train stops.

Doors open.

Player exits.

The player enters a simplified 3D interchange corridor.

Signs show:

BLUE LINE
YELLOW LINE

The player walks toward:

YELLOW LINE → PLATFORM

Then arrives at another platform.

A Yellow Line train arrives.

Player boards.

The interior changes.

The journey continues.

This should feel like a genuine Metro interchange.

For MVP, only implement ONE highly polished interchange.

---

# 12. WALKING

Inside stations/interchanges, allow first-person walking.

Controls:

W = forward
S = backward
A = left
D = right
Mouse = look

Shift = optional sprint

Collision detection should prevent the player from walking through:

- walls
- trains
- barriers
- doors
- platforms

Keep the movement smooth.

---

# 13. METRO MAP

Press M to open the Delhi Metro map.

The map should show:

- Metro lines
- stations
- interchange stations
- current train
- current station
- destination
- route

The map should be a clean stylized representation.

It does NOT need to be geographically exact.

It should communicate the network clearly.

When the train moves:

The player's position on the map updates.

---

# 14. JOURNEY SELECTION

Before entering the train, provide a simple UI:

FROM:

[ Rajiv Chowk ]

TO:

[ Noida Sector 18 ]

Then:

[ START JOURNEY ]

The simulator calculates the route.

Example:

Rajiv Chowk
↓
Blue Line
↓
Noida Sector 18

For interchange:

Dwarka
↓
Blue Line
↓
Rajiv Chowk
↓
Yellow Line
↓
Destination

Show:

Journey time
Number of stops
Interchanges
Current line

---

# 15. FIRST-PERSON HUD

Keep the HUD minimal.

Top-left:

CURRENT LINE
BLUE LINE

Top-center:

NEXT STATION
Mandi House

Bottom-left:

Current speed

Bottom-right:

Journey progress

Do NOT clutter the screen.

During normal travel the HUD should almost disappear.

Immersion is more important.

---

# 16. DIGITAL TRAIN DISPLAY

Inside the train, create an actual digital display.

Example:

NEXT STATION

MANDI HOUSE

Then:

NEXT STATION

YAMUNA BANK

When approaching the station:

ARRIVING AT

YAMUNA BANK

This display should update from the journey state.

---

# 17. AUDIO

Audio is extremely important for immersion.

Create an audio system.

Sounds:

- train motor
- rail noise
- door opening
- door closing
- warning beep
- station ambience
- passenger ambience
- announcement
- braking
- acceleration
- tunnel ambience

Announcements should change based on the station.

Example:

"Next station, Mandi House."

At interchange:

"This station provides interchange with the Yellow Line."

Keep audio modular so additional announcements can be added easily.

---

# 18. PASSENGER SYSTEM

Create simple NPC passengers.

Passengers should:

- stand on platforms
- wait for train
- board
- leave train
- sit
- stand
- move through interchange

They don't need advanced AI.

Use simple state machines:

WAITING
BOARDING
RIDING
EXITING
WALKING

Optimize heavily.

Use instancing where possible.

---

# 19. OUTSIDE WORLD

The outside world should feel like Delhi.

Create modular environments.

Environment types:

UNDERGROUND
ELEVATED
URBAN
HIGHWAY
RESIDENTIAL
CENTRAL_DELHI
NOIDA

Examples:

Delhi:

- roads
- trees
- buildings
- traffic
- street lights

Noida:

- tall buildings
- wide roads
- offices
- flyovers
- modern skyline

Do not attempt to model the entire Delhi city.

Create convincing corridor environments around the Metro route.

---

# 20. DAY/NIGHT

Add a dynamic time system.

Modes:

MORNING
AFTERNOON
EVENING
NIGHT

Lighting should change.

Morning:

soft sunlight

Afternoon:

bright environment

Evening:

warm sunset

Night:

city lights
station lights
train lights

The player can select the time before starting the journey.

---

# 21. WEATHER

Add optional weather:

CLEAR
RAIN
FOG

Rain should affect the outside environment.

Show:

- rain
- wet roads
- reflections
- darker sky

Inside the train, the player sees rain through the windows.

---

# 22. PHYSICS / TRAIN FEEL

Make the train feel physical.

When accelerating:

very subtle backward camera movement.

When braking:

very subtle forward movement.

During travel:

tiny vibration.

When entering station:

subtle braking vibration.

Do NOT exaggerate these effects.

The goal is realism.

---

# 23. CINEMATIC MODE

Add an optional cinematic mode.

Press C.

Camera automatically performs cinematic shots:

- train leaving station
- exterior train shot
- train entering tunnel
- train crossing elevated section
- station arrival

Then return to first-person.

This is useful for the final presentation/demo.

---

# 24. GOD MODE / NETWORK VIEW

Press G.

Camera exits the train.

Zoom out above Delhi.

Show the entire Metro network.

Multiple trains can move simultaneously.

Each train follows its line color.

Blue trains → Blue Line.

Yellow trains → Yellow Line.

Red trains → Red Line.

Then select a train and press ENTER.

Camera flies back into that train.

Return to first-person mode.

This should be a major visual reveal.

---

# 25. MAIN MENU

Create a beautiful minimal menu.

Title:

DELHI METRO

Subtitle:

3D METRO SIMULATOR

Buttons:

[ START JOURNEY ]

[ METRO MAP ]

[ FREE RIDE ]

[ SETTINGS ]

Free Ride:

Choose line and station.

Journey:

Choose origin/destination.

---

# 26. FREE RIDE MODE

Free Ride removes missions.

The user can simply explore.

Choose:

LINE
↓
STATION
↓
BOARD TRAIN

Then enjoy the journey.

This should be the default demo mode.

---

# 27. GAME / MISSION MODE

Optional future feature.

Examples:

MISSION 1
Travel from Rajiv Chowk to Noida Sector 18.

MISSION 2
Change from Blue Line to Yellow Line.

MISSION 3
Reach destination before a timer expires.

MISSION 4
Explore five stations.

MISSION 5
Complete a journey during rush hour.

---

# 28. VISUAL QUALITY

Prioritize:

1. Lighting
2. Materials
3. Camera
4. Train interior
5. Station environment
6. Animation
7. Audio
8. Detail

Do NOT sacrifice performance for unnecessary geometry.

Use:

- low-poly modular assets
- instancing
- LOD where appropriate
- baked/static lighting where possible
- optimized textures
- frustum culling

Target:

60 FPS on a reasonable modern laptop.

---

# 29. IMPORTANT UX PRINCIPLE

The player should NOT constantly see menus.

The experience should be:

ENTER TRAIN

↓

LOOK AROUND

↓

TRAIN DEPARTS

↓

WATCH DELHI PASS BY

↓

HEAR ANNOUNCEMENT

↓

ARRIVE AT STATION

↓

CHANGE TRAIN

↓

CONTINUE JOURNEY

The simulator should feel continuous.

---

# 30. MVP PRIORITY

Do NOT attempt everything initially.

Build in this order.

PHASE 1:

First-person camera
+
Mouse look
+
Train interior
+
Basic train movement

PHASE 2:

One realistic station
+
Platform
+
Train doors
+
Arrival/departure

PHASE 3:

3–5 stations
+
route system
+
digital display
+
announcements

PHASE 4:

Second Metro line
+
interchange
+
walking
+
boarding second train

PHASE 5:

Delhi environment
+
outside scenery
+
lighting
+
passengers

PHASE 6:

Metro map
+
journey selection
+
day/night

PHASE 7:

weather
+
cinematic mode
+
network/God mode

---

# 31. DEMO JOURNEY

The primary demo should be:

RAJIV CHOWK → NOIDA SECTOR 18

Start inside the train.

Player looks around.

Train doors close.

Announcement:

"Doors are closing."

Train departs.

Player looks through the window.

Delhi environment moves outside.

Train approaches:

MANDI HOUSE

Then:

YAMUNA BANK

Then:

NOIDA SECTOR 15

Then:

NOIDA SECTOR 16

Then:

NOIDA SECTOR 18

Train stops.

Doors open.

Journey complete.

---

# 32. THE "WOW" MOMENT

The simulator must have a moment where the player realizes:

"This isn't a static 3D model."

The train is actually travelling.

The world is moving.

Stations are appearing dynamically.

Announcements match the journey.

The Metro map tracks the train.

The camera is fully first-person.

The player can look around.

The player can leave the train.

The player can change lines.

The player can board another train.

The journey continues.

---

# 33. CODE QUALITY

Keep the code modular.

Separate:

- rendering
- game state
- train movement
- player movement
- metro network
- station data
- audio
- passengers
- UI
- environment

Do not create one giant component.

Use TypeScript types for:

Station
MetroLine
Train
Journey
Passenger
Environment

All Metro data should be configuration-driven.

---

# 34. DEVELOPMENT APPROACH

Build a working MVP first.

Do not spend hours creating assets before the core loop works.

First prove:

PLAYER → TRAIN → MOVE → STATION → STOP → DOORS → NEXT STATION

Then add visual polish.

After the core simulator works, improve:

lighting
materials
environment
passengers
audio
animations
UI

---

# 35. FINAL PRODUCT FEEL

The final result should feel like:

Microsoft Flight Simulator

BUT FOR THE DELHI METRO.

The player should feel like they are physically present inside the train.

Not like they are controlling a train from outside.

Not like they are looking at a 3D map.

Not like they are playing a simple train game.

The camera is the player's eyes.

The train is the player's vehicle.

Delhi is the world.

The Metro network is the game.

Build the first playable vertical slice before adding additional features.