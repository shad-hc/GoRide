const driverService = require('../services/driver.service');

const ok = (res, data) => res.json({ success: true, ...data });

async function setAvailability(req, res, next) {
  try {
    const { available, lat, lng } = req.body;
    const driver = await driverService.setDriverOnlineStatus(
      req.user._id.toString(),
      available,
      lat && lng ? { lat, lng } : null
    );
    ok(res, { driver });
  } catch (err) { next(err); }
}

async function updateLocation(req, res, next) {
  try {
    await driverService.updateDriverLocation(req.user._id.toString(), req.body);
    ok(res, { message: 'Location updated' });
  } catch (err) { next(err); }
}

async function nearbyDrivers(req, res, next) {
  try {
    const { lat, lng, radius, vehicleType } = req.query;
    const drivers = await driverService.findNearbyDrivers(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseInt(radius) : undefined,
      vehicleType
    );
    ok(res, { drivers, count: drivers.length });
  } catch (err) { next(err); }
}

async function getStats(req, res, next) {
  try {
    const stats = await driverService.getDriverStats(req.user._id.toString());
    ok(res, { stats });
  } catch (err) { next(err); }
}

module.exports = { setAvailability, updateLocation, nearbyDrivers, getStats };
