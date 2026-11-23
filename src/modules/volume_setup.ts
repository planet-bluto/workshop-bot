import fs from 'node:fs/promises';
import path from 'path';

const FOLDERS = ["db", "img"]

for (const folder of FOLDERS) {
  try {
    fs.mkdir(path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, folder)).catch(reason => {
      print("Already exists: ", folder)
    })
  } catch(err) {
    print("Already exists: ", folder)
  }
}