var cloudmask_sr = function (original_image, qa_band) {
    // Error handling
    if (original_image === undefined) error('cloudmask_sr', 'You need to specify an input image.');
    if (qa_band === undefined) error('cloudmask_sr', 'You need to specify an input QA band.');

    var getQABits = function (qa_band, start, end, newName) {
        var pattern = 0;
        for (var i = start; i <= end; i++) {
            pattern += Math.pow(2, i);
        }

        return qa_band.select([0], [newName])
            .bitwiseAnd(pattern)
            .rightShift(start);
    };

    var cs = getQABits(qa_band, 3, 3, 'Cloud_shadows').eq(0);
    var c = getQABits(qa_band, 5, 5, 'Cloud').eq(0);

    original_image = original_image.updateMask(cs);
    return original_image.updateMask(c);
};

var build_annual_landsat_timeseries = function (roi) {

    roi = typeof roi !== 'undefined' ? roi : ee.Geometry.Point([-43.0879, -22.8632]);

    var ls5_sr = ee.ImageCollection("LANDSAT/LT05/C01/T1_SR"),
        ls7_sr = ee.ImageCollection("LANDSAT/LE07/C01/T1_SR"),
        ls8_sr = ee.ImageCollection("LANDSAT/LC08/C01/T1_SR");

    var ls5_ic = ee.ImageCollection(ls5_sr)
        .filterBounds(roi)
        .filterDate('1985-01-01', '2011-12-31')

    var ls7_ic = ee.ImageCollection(ls7_sr)
        .filterBounds(roi)
        .filterDate('1999-01-01', '2017-12-31')

    var ls8_ic = ee.ImageCollection(ls8_sr)
        .filterBounds(roi)
        .filterDate('2013-05-01', '2017-12-31')


    function rename_bands_tm(image) {
        var bands = ['B1', 'B2', 'B3', 'B4', 'B5', 'B7', 'NDVI', 'NDWI', 'SAVI'];
        var new_bands = ['BLUE', 'GREEN', 'RED', 'NIR', 'SWIR1', 'SWIR2', 'NDVI', 'NDWI', 'SAVI'];
        return image.select(bands).rename(new_bands);
    }

    function rename_bands_oli(image) {
        var bands = ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'NDVI', 'NDWI', 'SAVI'];
        var new_bands = ['BLUE', 'GREEN', 'RED', 'NIR', 'SWIR1', 'SWIR2', 'NDVI', 'NDWI', 'SAVI'];
        return image.select(bands).rename(new_bands);
    }

    function calc_indices(image, satellite) {
        var ls_idx = landsat_indices(image, satellite);
        return ls_idx;
    }

    function mask_clouds(original_image, qa_band) {
        var masked_image = cloudmask_sr(original_image, qa_band);
        return masked_image;
    }

    function merge_bands(image, previous) {
        return ee.Image(previous).addBands(image);
    };


    var ls5_ic_idx = ls5_ic.map(function (image) { return calc_indices(image, "L5"); })
        .map(function (image) { return mask_clouds(image, image.select("pixel_qa")); })
        .map(rename_bands_tm);

    var ls7_ic_idx = ls7_ic.map(function (image) { return calc_indices(image, "L7"); })
        .map(function (image) { return mask_clouds(image, image.select("pixel_qa")); })
        .map(rename_bands_tm);

    var ls8_ic_idx = ls8_ic.map(function (image) { return calc_indices(image, "L8"); })
        .map(function (image) { return mask_clouds(image, image.select("pixel_qa")); })
        .map(rename_bands_oli);


    function collection_by_year_tm(collection_ls5, collection_ls7) {
        var start = '-01-01';
        var finish = '-12-31';
        var year_col_list = ee.List([]);


        for (var year = 1985; year <= 2012; year++) {

            var temp_col_list = ee.List([]);

            if (year >= 1999) {
                var year_col_ls5 = collection_ls5.filterDate(year.toString() + start, year.toString() + finish);
                var year_col_ls7 = collection_ls7.filterDate(year.toString() + start, year.toString() + finish);
                var collection = year_col_ls5.merge(year_col_ls7);
            }
            else {
                var collection = collection_ls5.filterDate(year.toString() + start, year.toString() + finish);
            }

            var new_blue = collection.select('BLUE').median();
            temp_col_list = temp_col_list.add(new_blue);
            var new_green = collection.select('GREEN').median();
            temp_col_list = temp_col_list.add(new_green);
            var new_red = collection.select('RED').median();
            temp_col_list = temp_col_list.add(new_red);
            var new_nir = collection.select('NIR').median();
            temp_col_list = temp_col_list.add(new_nir);
            var new_swir1 = collection.select('SWIR1').median();
            temp_col_list = temp_col_list.add(new_swir1);
            var new_swir2 = collection.select('SWIR2').median();
            temp_col_list = temp_col_list.add(new_swir2);
            var new_ndvi = collection.select('NDVI').max();
            temp_col_list = temp_col_list.add(new_ndvi);
            var new_ndwi = collection.select('NDWI').max();
            temp_col_list = temp_col_list.add(new_ndwi);
            var new_savi = collection.select('SAVI').max();
            temp_col_list = temp_col_list.add(new_savi);

            var by_year_temp = ee.ImageCollection(temp_col_list);
            var merged = by_year_temp.iterate(merge_bands, ee.Image([]));
            year_col_list = year_col_list.add(merged);
        }

        var by_year = ee.ImageCollection(year_col_list)
        return by_year;
    }


    function collection_by_year_oli(collection_ls8) {
        var start = '-01-01';
        var finish = '-12-31';
        var year_col_list = ee.List([]);


        for (var year = 2013; year <= 2018; year++) {
            var temp_col_list = ee.List([]);
            var collection = collection_ls8.filterDate(year.toString() + start, year.toString() + finish);

            var new_blue = collection.select('BLUE').median();
            temp_col_list = temp_col_list.add(new_blue);
            var new_green = collection.select('GREEN').median();
            temp_col_list = temp_col_list.add(new_green);
            var new_red = collection.select('RED').median();
            temp_col_list = temp_col_list.add(new_red);
            var new_nir = collection.select('NIR').median();
            temp_col_list = temp_col_list.add(new_nir);
            var new_swir1 = collection.select('SWIR1').median();
            temp_col_list = temp_col_list.add(new_swir1);
            var new_swir2 = collection.select('SWIR2').median();
            temp_col_list = temp_col_list.add(new_swir2);
            var new_ndvi = collection.select('NDVI').max();
            temp_col_list = temp_col_list.add(new_ndvi);
            var new_ndwi = collection.select('NDWI').max();
            temp_col_list = temp_col_list.add(new_ndwi);
            var new_savi = collection.select('SAVI').max();
            temp_col_list = temp_col_list.add(new_savi);

            var by_year_temp = ee.ImageCollection(temp_col_list);
            var merged = by_year_temp.iterate(merge_bands, ee.Image([]));
            year_col_list = year_col_list.add(merged);
        }

        var by_year = ee.ImageCollection(year_col_list)
        return by_year;
    }


    var tm_by_year = collection_by_year_tm(ls5_ic_idx, ls7_ic_idx);
    var oli_by_year = collection_by_year_oli(ls8_ic_idx);

    var merged_collections_by_year = tm_by_year.merge(oli_by_year);

    // Add Metadata to merged_collections_by_year (year of each image)
    var merged_list = merged_collections_by_year.toList(merged_collections_by_year.size());
    var temp_merged_list = ee.List([]);
    var num_of_imgs = merged_collections_by_year.size().getInfo();
    num_of_imgs--;
    for (var i = 0; i <= num_of_imgs; i++) {
        var img = ee.Image(merged_list.get(i));
        img = img.set("Year", (i + 1985).toString());
        temp_merged_list = temp_merged_list.add(img);
    }
    merged_collections_by_year = ee.ImageCollection(temp_merged_list);

    return (merged_collections_by_year);
}