# Game Library Management

Game Library Management is a full-stack game tracking platform where users can discover games, build a personal library, review titles, and interact with other players in real time.

## What This Project Includes

- Backend API built with ASP.NET Core 8 (layered into `PL`, `BL`, `DAL` projects)
- SQL Server persistence with Entity Framework Core and ASP.NET Identity
- JWT authentication with refresh token flow
- RAWG integration for game discovery/import
- SignalR hubs for live chat, presence, and friend-request notifications
- Frontend website (HTML/CSS/JS) with pages for auth, dashboard, game details, community, and profile

## Core Features Implemented

### 1. Authentication & Security

- User registration and login
- JWT-based authorization for protected endpoints
- Refresh token issuance/revocation
- Role support (`AddToRole` endpoint)

### 2. Game Catalog & Discovery

- Browse external game catalog via RAWG
- Search games by query
- Filter by genre, platform, release date, and rating ordering
- View full game details (description, media, platforms, metadata)
- Similar games recommendations
- Import catalog games to local system

### 3. Personal Library Management

- Add games to user library
- Track status (playing, completed, dropped, on hold, pending, wishlist)
- Mark favorites
- Add ratings
- Move games between library and wishlist views
- Get games by status
- Public profile library view for other users

### 4. Reviews System

- Create, update, and delete reviews
- Vote on reviews
- Review display on game details pages

### 5. Social Features

- Send, accept, and remove friend requests
- View pending friend requests
- View friends list for profiles
- User search for adding friends

### 6. Real-Time Communication (SignalR)

- Community chat room
- Live typing indicators
- Persisted chat history
- Presence tracking (online/offline)
- Real-time friend-request notifications and updates

### 7. Profile Management

- Private profile retrieval and public profile view
- Edit display name and bio
- Upload avatar and cover images
- Visitor mode for viewing other users

### 8. User Statistics

- Completed games
- Playing games
- Wishlist games
- Dropped games
- Rating-based segments: bad, good, perfect games

## Project Structure

```text
Game Library Management.sln
|- Game Library Management/      # Presentation layer (API + controllers + hubs)
|- GLM.BL/                       # Business logic layer (services, DTOs, UoW)
|- GLM.DAL/                      # Data access layer (EF Core, models, migrations)
`- GLM.FrontEnd/                 # Website pages and scripts
```

## Main API Areas

- `AuthenticationController`: register/login/refresh/revoke/roles
- `RAWGController`: external catalog, search, import, similar games, quick actions
- `UserGamesController`: personal library CRUD and filtering
- `ReviewsController`: review CRUD + voting
- `ProfileController`: own/public profile + updates + user search
- `FriendshipController`: friendship lifecycle and pending requests
- `CommunityController`: chat history
- `StatsController`: user insights by status/rating group

## Frontend Pages

- `GLM.FrontEnd/Auth/Html/login.html`: login/register flows
- `GLM.FrontEnd/Dashboard/Html/dashboard.html`: catalog/library/favorites/wishlist
- `GLM.FrontEnd/GameDetails/Html/game-details.html`: details, reviews, similar games
- `GLM.FrontEnd/Community/Html/community.html`: real-time chat
- `GLM.FrontEnd/Profile/Html/profile.html`: own profile
- `GLM.FrontEnd/Profile/Html/visit-profile.html`: public profile view
- `GLM.FrontEnd/Profile/Html/friends.html`: friends list and friend management

## Local Setup

### Prerequisites

- .NET SDK 8.0+
- SQL Server (or SQL Server Express)
- Visual Studio 2022 or VS Code with C# tooling

### 1. Configure App Settings

Edit `Game Library Management/appsettings.json`:

- `ConnectionStrings:constr`: point to your SQL Server instance
- `JWT`: set key/issuer/audience suitable for your environment
- `RAWG:ApiKey`: use your own RAWG API key

### 2. Apply Database Migrations

Run from repository root:

```bash
dotnet ef database update --project "GLM.DAL/Game Library Management_DAL.csproj" --startup-project "Game Library Management/Game Library Management_PL.csproj"
```

### 3. Run the API

```bash
dotnet run --project "Game Library Management/Game Library Management_PL.csproj"
```

Default dev URLs:

- API: `http://localhost:5268`
- Swagger: `http://localhost:5268/swagger`
- SignalR hubs:
	- `http://localhost:5268/chat`
	- `http://localhost:5268/notifications`

### 4. Run the Frontend

The frontend is static HTML/CSS/JS.

Open:

- `GLM.FrontEnd/Auth/Html/login.html`

or serve `GLM.FrontEnd` with any static server.

Note: Frontend scripts currently target `http://localhost:5268` as the API base URL.

