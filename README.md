# Free Fire UID Info

## Run locally
1. Install Node.js 18+.
2. Run `npm install`
3. Run `npm start`
4. Open `http://localhost:3000`

## Railway
Upload this project to GitHub, connect the repository to Railway, and deploy.
No PORT setting is required; Railway supplies `PORT`.

## Features
- UID + region lookup
- Nickname, level, likes, BR/CS rank and points
- Detailed player stats when the external endpoint returns them
- Guild and wishlist backend endpoints
- 60-second server cache
- Request timeout and validation
- Mobile-friendly frontend

## API source
The default external API is the public `jinix6/free-ff-api` service documented in its repository.
Its availability is outside this project and can change.
You can override the API base with `FF_API_BASE`.
