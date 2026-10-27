# How to Change the Birthday Song

This project uses one shared music player from Page 2 through Page 6. You can replace the track without editing the player or page-navigation code.

## Current song files and settings

- Music folder: `public/audio/`
- Current audio file: `public/audio/birthday-song.mp3`
- Music settings: the `audio` section in `src/config/birthdayConfig.ts`
- Current artwork: `public/images/gallery/photo-01.jpg`

The current settings look like this:

```ts
audio: {
  enabled: true,
  src: `${import.meta.env.BASE_URL}audio/birthday-song.mp3`,
  showControls: true,
  defaultVolume: 0.5,
  title: "Tum Ho Toh",
  subtitle: "BIRTHDAY PLAYLIST",
  artwork: `${import.meta.env.BASE_URL}images/gallery/photo-01.jpg`,
},
```

## Recommended method: replace the file and keep its name

1. Open the project folder in File Explorer or VS Code.
2. Open `public/audio/`.
3. Copy your new MP3 into that folder and replace `birthday-song.mp3`. Keep that exact filename.
4. Open `src/config/birthdayConfig.ts` and change `title` to the song title you want displayed. You can also change `subtitle` or the `artwork` path.
5. Save the file. Refresh the website. If the old song is still cached, use **Ctrl+F5** for a full refresh.

Replacing the file under the same name is the easiest option because the audio path does not need to change. The browser will usually pick up the new file after a refresh; if it does not, restart the Vite server and refresh again.

## If you want to use a different filename

1. Put the new MP3 in `public/audio/`, for example `my-new-song.mp3`.
2. In the `audio` section of `src/config/birthdayConfig.ts`, change only the filename in `src`:

   ```ts
   src: `${import.meta.env.BASE_URL}audio/my-new-song.mp3`,
   ```

3. Change `title` to the displayed song name and save. The `BASE_URL` part helps the path work both in development and in a built website.

## Change the player artwork

Put the image in `public/images/` or one of its existing subfolders, then update `artwork`. For example, for `public/images/my-cover.jpg`, use:

```ts
artwork: `${import.meta.env.BASE_URL}images/my-cover.jpg`,
```

The existing `photo-01.jpg` is the current square thumbnail. If an artwork path is missing, the player displays a decorative fallback instead.

## Run and check the song

1. In VS Code, open **Terminal → New Terminal** in the project folder.
2. Run `npm run dev` and open the local address Vite prints in the terminal.
3. Continue from Page 1 to Page 2 (the birthday reveal). The player appears there and attempts to start the song.
4. Some browsers block sound that starts automatically. If the player says **TAP PLAY TO START**, click its round Play button. You can also pause and resume, adjust the volume, and use the progress bar to seek.
5. Navigate through Pages 3, 4, 5, and 6. Playback time should continue without restarting. The player is shared by the app and stays mounted as those pages change.
6. The **Replay the Experience** button intentionally stops and rewinds the song when it returns to Page 1. It starts again when you reach Page 2.

To make a production build after changing the song or its settings, run `npm run build`. Vite copies `public/audio/birthday-song.mp3` into `dist/audio/` for the built website.

## If it does not play

- Check that the file is in `public/audio/` and that its name exactly matches the `src` setting, including `.mp3`.
- If you used a different filename, confirm that you updated `src` in `src/config/birthdayConfig.ts`.
- If autoplay was blocked, use the Play button; this is normal browser behavior. Check that the browser tab is not muted and that the player volume is above zero.
- If the player reports that the song could not load, check the browser's developer console for the audio path and a missing-file (404) error.
- After replacing a file with the same name, refresh the page. If needed, restart the development server and use **Ctrl+F5**.

Use an MP3 file for this configured song. The supplied track is about 4.7 MB. A compressed MP3 is generally quicker to load than an uncompressed WAV; very large files may take longer on mobile connections.
