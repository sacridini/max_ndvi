var roi = ee.FeatureCollection("users/elacerda/estado_rj"); // shapefile estado rj
var geet = require('users/elacerda/geet:geet');
var ls_collection = geet.build_annual_landsat_timeseries(roi);

var get_ndvi = function(image) {
  return image.select("NDVI")
}

var ndvi_ts = ls_collection.map(get_ndvi);
var ndvi_ts_max = ndvi_ts.median();
print(ndvi_ts_max)

Export.image.toDrive({
  image: ndvi_ts_max, 
  description: "max_ndvi_ts_rj", 
  folder: 'ee', 
  fileNamePrefix: "max_ndvi_ts_rj", 
  region: roi,
  scale: 30, 
  crs: 'EPSG:4326', 
  maxPixels: 1e13
});