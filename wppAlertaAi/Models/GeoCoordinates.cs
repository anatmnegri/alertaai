namespace AlertAi.Models;

public static class GeoCoordinates
{
    public static bool TryValidate(double? latitude, double? longitude, out double lat, out double lng)
    {
        lat = 0;
        lng = 0;

        if (!latitude.HasValue || !longitude.HasValue)
            return false;

        if (!double.IsFinite(latitude.Value) || !double.IsFinite(longitude.Value))
            return false;

        if (Math.Abs(latitude.Value) < 0.0001 && Math.Abs(longitude.Value) < 0.0001)
            return false;

        if (latitude.Value is < -90 or > 90)
            return false;

        if (longitude.Value is < -180 or > 180)
            return false;

        lat = latitude.Value;
        lng = longitude.Value;
        return true;
    }
}
