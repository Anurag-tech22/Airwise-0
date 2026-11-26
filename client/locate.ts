import { nearestCity } from "../shared/cities";
import { currentPosition, geoMessage } from "./lib";

/** Finds the nearest listed city from the device position, entirely in the browser (coordinates are never sent). */
export async function locate(setCity: (cityId: string) => void, setMsg: (message: string) => void) {
  setMsg("Finding the nearest city…");
  try {
    const { coords } = await currentPosition();
    const near = nearestCity(coords.latitude, coords.longitude);
    if (near) {
      setCity(near.city.id);
      setMsg(
        `Nearest listed city: ${near.city.name} (${Math.round(near.km)} km away). Your location stays on this device.`,
      );
    } else {
      setMsg("No listed city within 150 km — please choose one from the list.");
    }
  } catch (e) {
    setMsg(geoMessage(e));
  }
}
