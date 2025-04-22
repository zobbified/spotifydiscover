const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = 3000;

app.use(express.static("public"));

let accessToken = "";

async function getAccessToken() {
  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    new URLSearchParams({ grant_type: "client_credentials" }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            process.env.SPOTIFY_CLIENT_ID +
              ":" +
              process.env.SPOTIFY_CLIENT_SECRET
          ).toString("base64"),
      },
    }
  );

  accessToken = response.data.access_token;
}

getAccessToken();

app.get("/search", async (req, res) => {
  const artist = req.query.artist;
  const song = req.query.song;

  try {
    // 1. Search for the song
    const trackSearch = await axios.get("https://api.spotify.com/v1/search", {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { q: `track:${song} artist:${artist}`, type: "track", limit: 1 },
    });

    const track = trackSearch.data.tracks.items[0];
    if (!track) return res.json({ results: [] });

    // 2. Get the artist ID
    const artistId = track.artists[0].id;

    // 3. Get artist details (for genres)
    const artistRes = await axios.get(
      `https://api.spotify.com/v1/artists/${artistId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const genres = artistRes.data.genres;
    if (genres.length === 0) return res.json({ results: [] });

    const primaryGenre = genres[0]; // just pick one genre to focus on

    // 4. Search for tracks in the same genre (via artist search)
    const artistSearch = await axios.get("https://api.spotify.com/v1/search", {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        q: `genre:"${primaryGenre}"`,
        type: "artist",
        limit: 5,
      },
    });

    const similarArtistIds = artistSearch.data.artists.items.map((a) => a.id);

    let similarTracks = [];

    // 5. For each similar artist, get top tracks
    for (const id of similarArtistIds) {
      const topTracksRes = await axios.get(
        `https://api.spotify.com/v1/artists/${id}/top-tracks`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { market: "US" },
        }
      );

      similarTracks.push(...topTracksRes.data.tracks);
    }

    res.json({ results: similarTracks.slice(0, 10) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
