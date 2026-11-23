import { DateTime } from "luxon";

const startTime = DateTime.now()

print("DateTime: ", startTime.toObject({
  includeConfig: true,
}))

print("DateTime.zone: ", startTime.zone.name)