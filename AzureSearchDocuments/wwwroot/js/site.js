//Initialize Fabric elements
var SpinnerElements = document.querySelectorAll(".ms-Spinner");
for (var i = 0; i < SpinnerElements.length; i++) {
    new fabric['Spinner'](SpinnerElements[i]);
}

// Modal Controls

$('#next-control').click(function () {
    var idx = parseInt($('#result-id').val());

    if (idx < results.length) {
        ShowDocument(idx + 1);
    }
});

$('#prev-control').click(function () {
    var idx = parseInt($('#result-id').val());

    if (idx > 0) {
        ShowDocument(idx - 1);
    }
});

var $grid = $('#doc-details-div');

// Initialize properties
var q, sortType, tempdata;
var results = [];
var facets = [];
var selectedFacets = [];
var riskItems = [];
var currentPage = 1;
var searchId;
var searchServiceName = "wkeapsearch";
var indexName = "chainindex";
var scoringProfile = "";
var flag = false;

$(document).ready(function () {
    if (q) {
        document.getElementById('q').value = q;
    }
    Search();
});

// When 'Enter' clicked from Search Box, execute Search()
$("#q").keyup(function (e) {
    if (e.keyCode === 13) {
        Search();
    }
});

$("#transcript-search-input").keyup(function (e) {
    if (e.keyCode === 13) {
        SearchTranscript($('#transcript-search-input').val());
    }
});

// Search with query and facets
function Search() {
    if ($('#doc-count').html() != "") {
        $('#loading-indicator').show();
    }
    else $('#progress-indicator').show();

    q = $("#q").val();

    // Get center of map to use to score the search results
    $.get('/api/GetDocuments',
        {
            q: q != undefined ? q : "*",
            searchFacets: selectedFacets,
            currentPage: currentPage
        },
        function (data) {
            $('#loading-indicator').css("display", "none");
            $('#progress-indicator').css("display", "none");
            UpdateResults(data);
        });
}

function UpdateResults(data) {
    results = data.results;
    facets = data.facets;

    //Facets
    UpdateFacets();

    //Results List
    UpdateDetails(data);

    //Pagination
    UpdatePagination(data.count);

    //Filters
    UpdateFilterReset();

    InitLayout();

    $('html, body').animate({ scrollTop: 0 }, 'fast');

    FabricInit();
}

//Filters
function UpdateFilterReset() {
    // This allows users to remove filters
    var htmlString = '';
    $("#filterReset").html("");

    if (selectedFacets && selectedFacets.length > 0) {
        htmlString += '<h5 class="facet-header" style="margin-top:30px;">CURRENT FILTERS</h5>';

        selectedFacets.forEach(function (item, index, array) { // foreach facet with a selected value
            var name = item.key;
            var result = facets.filter(function (f) { return f.key === name; })[0];

            if (item.value && item.value.length > 0) {
                item.value.forEach(function (item2, index2, array) {
                    var idx = result.value.indexOf(result.value.filter(function (v) { return v.value === item2; })[0]);

                    htmlString += item2 + ` <a href="javascript:void(0)" onclick="RemoveFilter(\'${name}\', \'${item2}'\)"><span class="ms-Icon ms-Icon--Clear"></span></a><br>`;
                    $('#' + name + '_' + idx).addClass('is-checked');
                })
            }
            else if (item.dataType == "System.DateTimeOffset") {
                htmlString += item.minValue + " - " + item.maxValue + `<a href="javascript:void(0)" onclick="RemoveFilter(\'${name}\')"><span class="ms-Icon ms-Icon--Clear"></span></a><br>`;
                $('#' + name + '_' + index).addClass('is-checked');
            }
        })
    }
    $("#filterReset").html(htmlString);
}

function RemoveFilter(facet, value = null) {

    var result = selectedFacets.filter(function (f) { return f.key === facet; })[0];

    if (value && result) {
        var idx = selectedFacets.indexOf(result);

        if (result.value.length <= 1) {
            selectedFacets.pop(result);
        }
        else {
            result.value.pop(value);
        }
    }
    else if (result){
        selectedFacets.pop(result);
    }

    Search();
}

// Facets
function UpdateFacets() {
    $("#facet-nav").html("");

    facets.forEach(function (item, index, array) {
        var name = item.key;
        var data = item.value;
        var dataType = item.type;
        var facetResultsHTML = "";

        if (data != null) {
            var title = name.replace(/([A-Z])/g, ' $1').replace(/^./, function (str) { return str.toUpperCase(); });
            title = title.toUpperCase();

            if (item.dataType == "System.DateTimeOffset") { // handle other range facets later

                var min = item.min ? Date.parse(item.min) : new Date(2016, 01, 01);
                var max = item.max ? Date.parse(item.max) : new Date(2017, 12, 31);

                facetResultsHTML = `<div class="filter-list" id="${name}-facets">
                                        <h5 class="facet-header">${title}</h5>
                                        <div id="${name}-range-facet"></div>
                                        <div id="${name}-range-facet-label"></div>
                                    </div>`;

                $("#facet-nav").append(facetResultsHTML);

                // add jquery ui slider with min and max dates
                $(`#${name}-range-facet`).slider({
                    range: true,
                    min: new Date(2016, 01, 01).getTime() / 1000,
                    max: new Date(2017, 12, 31).getTime() / 1000,
                    step: 86400,
                    values: [
                        min.getTime() / 1000,
                        max.getTime() / 1000
                    ],
                    slide: function (event, ui) {
                        $(`#${name}-range-facet-label`).html(
                            (new Date(ui.values[0] * 1000).toDateString()) + " - " + (new Date(ui.values[1] * 1000)).toDateString());
                    },
                    stop: function (event, ui) {
                        ChooseRangeFacet(name, new Date(ui.values[0] * 1000).toDateString(), new Date(ui.values[1] * 1000).toDateString(), dataType);
                    }
                });
                $(`#${name}-range-facet-label`).html(
                    (new Date($(`#${name}-range-facet`).slider("values", 0) * 1000).toDateString())
                    + " - "
                    + (new Date($(`#${name}-range-facet`).slider("values", 1) * 1000)).toDateString());
            }
            else if (data.length > 0) {
                facetResultsHTML = `<div class="filter-list" id="${name}-facets"><h5 class="facet-header">${title}</h5>`;

                for (var j = 0; j < data.length; j++) {
                    if (data[j].value.length < 30) {
                        facetResultsHTML += `<div class="ms-CheckBox">
                                            <input tabindex="-1" type="checkbox" class="ms-CheckBox-input" onclick="ChooseFacet('${name}','${data[j].value}');">
                                            <label id="${name}_${j}" role="checkbox" class="ms-CheckBox-field" tabindex="0" aria-checked="false" name="checkboxa">
                                                <span class="ms-Label">${data[j].value} (${data[j].count})</span> 
                                            </label>
                                        </div>`;
                    }
                }

                facetResultsHTML += `</div>`;
                $("#facet-nav").append(facetResultsHTML);
            }
        }
    })
}

function ChooseFacet(facet, value) {
    if (selectedFacets != undefined) {
        // facetValues where key == selected facet
        var result = selectedFacets.filter(function (f) { return f.key === facet; })[0];
        
        if (result) { // if that facet exists
            var idx = selectedFacets.indexOf(result);

            if (!result.value.includes(value)) {
                result.value.push(value);
            }
            else {
                result.value.pop(value);
            }

            selectedFacets[idx] = result;
        }
        else {
            selectedFacets.push({
                key: facet,
                value: [value]
            })
        }
    }
    Search();
}

function ChooseRangeFacet(facet, min, max, dataType) {
    if (selectedFacets != undefined) {
        // facetValues where key == selected facet
        var result = selectedFacets.filter(function (f) { return f.key === facet; })[0];

        if (result) { // if that facet exists
            var idx = selectedFacets.indexOf(result);
            result.minValue = min;
            result.maxValue = max;
            result.dataType = dataType,
                selectedFacets[idx] = result;
        }
        else {
            selectedFacets.push({
                key: facet,
                minValue: min,
                maxValue: max,
                dataType: dataType
            })
        }
    }
    Search();
}

function LogSearchAnalytics(docCount) {

    if (docCount != null) {
        appInsights.trackEvent("Search", {
            SearchServiceName: searchServiceName,
            SearchId: searchId,
            IndexName: indexName,
            QueryTerms: q,
            ResultCount: docCount,
            ScoringProfile: scoringProfile
        });
    }
}

function LogClickAnalytics(fileName, index) {
    appInsights.trackEvent("Click", {
        SearchServiceName: searchServiceName,
        SearchId: searchId,
        ClickedDocId: fileName,
        Rank: index
    });
}

function UpdatePagination(docCount) {
    var totalPages = Math.round(docCount / 25);
    // Set a max of 5 items and set the current page in middle of pages
    var startPage = currentPage;
    //if (startPage === 1 || startPage === 2)
    //    startPage = 1;
    //else
    //    startPage -= 2;

    var maxPage = startPage + 5;
    if (totalPages < maxPage)
        maxPage = totalPages + 1;
    var backPage = parseInt(currentPage) - 1;
    if (backPage < 1)
        backPage = 1;
    var forwardPage = parseInt(currentPage) + 1;

    var htmlString = "";
    if (currentPage > 1) {
        htmlString = `<li><a href="javascript:void(0)" onclick="GoToPage('${backPage}')" class="ms-Icon ms-Icon--ChevronLeftMed"></a></li>`;
    }

    htmlString += '<li class="active"><a href="#">' + currentPage + '</a></li>';
    //for (var i = startPage; i < maxPage; i++) {
    //    if (i === currentPage)
    //        htmlString += '<li  class="active"><a href="#">' + i + '</a></li>';
    //    else
    //        htmlString += `<li><a href="javascript:void(0)" onclick="GoToPage('${parseInt(i)}'}>${i}</a></li>`;
    //}

    if (currentPage <= totalPages) {
        htmlString += `<li><a href="javascript:void(0)" onclick="GoToPage('${forwardPage}')" class="ms-Icon ms-Icon--ChevronRightMed"></a></li>`;
    }
    $("#pagination").html(htmlString);
    $("#paginationFooter").html(htmlString);
}

function GoToPage(page) {
    currentPage = page;
    Search();
}

function UpdateDetails(data) {
    var resultsHtml = '';
    var imgCounter = 0;
    var startDocCount = 0;

    if (data.count != 0) {
        startDocCount = 1;
    }
    var currentDocCount = currentPage * 10;

    if (currentPage > 1) {
        startDocCount = ((currentPage - 1) * 10) + 1;
    }
    if (currentDocCount > data.count) {
        currentDocCount = data.count;
    }

    $("#doc-count").html(` Available Results: ${data.count}`);
    //$("#doc-range").html(`${startDocCount} to ${currentDocCount} Results`);

    for (var i = 0; i < data.results.length; i++) {

        var result = data.results[i].document;
		var highlights = data.results[i].highlights;
        result.idx = i;
		
		var highlighttext = "";
		if (highlights!=null)
		{
		 for (var h = 0; h < highlights.text.length; h++) 
			 {
				highlighttext = highlighttext +  highlights.text[h];
			 }
		} 
	    else
			highlighttext = result.text.substring(0, 300);

        var filenName = result.fileName;
        var len = filenName.length-4;
        var name = filenName.substring(0, len);
        var path = result.fileName;
        var tags = "";//GetTagsHTML(result);
        var type = "";//result.formType;

        var url = result.url;

        /*if (result.formType == "UPLOAD") {
            type = "Comment Letter";
        }
        else if (result.exhibitType != result.formType) {
            type = "Exhibit"
        }*/

        var content = result.text;
             var excerpt = highlighttext;

        if (path !== null) {

            var classList = "results-div ";
            if (i === 0) classList += "results-sizer ";

            var pathLower = path.toLowerCase();

            if (pathLower.includes(".jpg") || pathLower.includes(".png")) {
                resultsHtml += `<div class="${classList}" onclick="ShowDocument(${i});">
                                    <div class="search-result">
                                        <div class="results-header">
                                            <h4><a href=${url}>${name}</a></h4>
                                        </div>
                                        <img class="img-result" style='max-width:100%;' src="${path}"/>

                                        <div>${tags}</div>
                                    </div>
                                </div>`;
            }
            else if (pathLower.includes(".mp3")) {
                resultsHtml += `<div class="${classList}" onclick="ShowDocument(${i});">
                                    <div class="search-result">
                                        <div class="results-header">
                                            <h4>${name}</h4>
                                        </div>
                                        <div class="audio-result-div">
                                            <audio controls>
                                                <source src="${path}" type="audio/mp3">
                                                Your browser does not support the audio tag.
                                            </audio>
                                        </div>

                                        <div>${tags}</div>                               
                                    </div>
                                </div>`;
            }
            else if (pathLower.includes(".mp4")) {
                resultsHtml += `<div class="${classList}" onclick="ShowDocument(${i});">
                                    <div class="search-result">
                                        <div class="results-header">
                                            <h4>${name}</h4>
                                        </div>
                                        <div class="video-result-div">
                                            <video controls class="video-result">
                                                <source src="${path}" type="video/mp4">
                                                Your browser does not support the video tag.
                                            </video>
                                        </div>
                                        <hr />

                                        <div>${tags}</div>                                 
                                    </div>
                                </div>`;
            }
            else {
                var icon = " ms-Icon--Page";

                if (pathLower.includes(".pdf")) {
                    icon = "ms-Icon--PDF";
                }
                else if (pathLower.includes(".htm")) {
                    icon = "ms-Icon--FileHTML";
                }
                else if (pathLower.includes(".xml")) {
                    icon = "ms-Icon--FileCode";
                }
                else if (pathLower.includes(".doc")) {
                    icon = "ms-Icon--WordDocument";
                }
                else if (pathLower.includes(".ppt")) {
                    icon = "ms-Icon--PowerPointDocument";
                }
                else if (pathLower.includes(".xls")) {
                    icon = "ms-Icon--ExcelDocument";
                }

                resultsHtml += `<div class="${classList}" onclick="ShowDocument(${i});">
                                    <div class="search-result">
                                    <div class="results-type">${type}</div>
                                       <div class="results-icon col-md-1">
                                            <div class="ms-CommandButton-icon">
                                                <i class="html-icon ms-Icon ${icon}"></i>
                                            </div>
                                        </div>
                                        <div class="results-body col-md-11">
                                            <h4><a href=${url}>${name}</a></h4>       
                                            <div>${excerpt}</div>
                                            <div style="margin-top:10px;">${tags}</div>
                                        </div>
                                    </div>
                                </div>`;
            }
        }
        else {
            // TODO: Handle errors showing result.
        }
    }

    // Log Search Events
    LogSearchAnalytics(data.count);

    $("#doc-details-div").html(resultsHtml);
}

// Details

function ShowDocument(index) {
    result = results[index].document;

    AddRecentDocument(result);

    var pivotLinksHTML = "";

    $('#details-pivot-content').html("");
    $('#reference-viewer').html("");
    $('#tag-viewer').html("");
    $('#details-viewer').html("").css("display", "none");

    $('#result-id').val(index);

    if (result.exhibitType == 'LETTER') {
        var letterHTML = GetLetterHTML(result);
        var transcriptContainerHTML = htmlDecode(result.content.trim());
        var detailsHTML = GetLetterDetailsHTML(result);

        $('#details-pivot-content').html(`<div id="letters-pivot" class="ms-Pivot-content" data-content="letters"></div>
                                            <div id="transcript-pivot" class="ms-Pivot-content" data-content="transcript">
                                                <div id="transcript-viewer" style="height: 100%;">
                                                    <div id='transcript-div'>
                                                        <pre id="transcript-viewer-pre"></pre>
                                                    </div>
                                                </div>
                                            </div>`);

        // Sets letters-pivot content
        $('#transcript-viewer-pre').html(transcriptContainerHTML);
        $('#details-viewer').html(detailsHTML).css("display", "block");

        pivotLinksHTML += `<li id="letters-pivot-link" class="ms-Pivot-link is-selected" data-content="letters" title="Letters" tabindex="1">Letters</li>
                            <li id="transcript-pivot-link" class="ms-Pivot-link " data-content="transcript" title="Transcript" tabindex="1">Transcript</li>`;
    }
    else {
        var fileContainerHTML = GetFileHTML(result);
        var transcriptContainerHTML = htmlDecode(result.content.trim());
        var fileName = "File";

        //if (result.description != "") {
        //    fileName = result.description;
        //}
        //else if (result.fileName != "") {
        //    fileName = result.fileName;
        //}

        $('#details-pivot-content').html(`<div id="file-pivot" class="ms-Pivot-content" data-content="file">
                                            <div id="file-viewer" style="height: 100%;"></div>
                                        </div>
                                        <div id="transcript-pivot" class="ms-Pivot-content" data-content="transcript">
                                            <div id="transcript-viewer" style="height: 100%;">
                                                <div id='transcript-div'>
                                                    <pre id="transcript-viewer-pre"></pre>
                                                </div>
                                            </div>
                                        </div>`);

        $('#file-viewer').html(fileContainerHTML);
        $('#transcript-viewer-pre').html(transcriptContainerHTML);

        pivotLinksHTML += `<li id="file-pivot-link" class="ms-Pivot-link is-selected" data-content="file" title="File" tabindex="1">${fileName}</li>
                           <li id="transcript-pivot-link" class="ms-Pivot-link " data-content="transcript" title="Transcript" tabindex="1">Transcript</li>`;
    }

    var tagContainerHTML = GetTagsClickHTML(result);

    $('#details-pivot-links').html(pivotLinksHTML);
    $('#tag-viewer').html(tagContainerHTML);
    $('#details-modal').modal('show');

    var PivotElements = document.querySelectorAll(".ms-Pivot");
    for (var i = 0; i < PivotElements.length; i++) {
        new fabric['Pivot'](PivotElements[i]);
    }

    //Log Click Events
    LogClickAnalytics(result.metadata_storage_name, index);
    GetSearchReferences(q);
}

function GetMatches(string, regex, index) {
    var matches = [];
    var match;
    while (match = regex.exec(string)) {
        matches.push(match[index]);
    }
    return matches;
}

function GetFileHTML(result) {

    var path = result.metadata_storage_path;

    if (path !== null) {

        var pathLower = path.toLowerCase();
        var fileContainherHTML;

        if (pathLower.includes(".pdf")) {
            fileContainerHTML =
                `<object class="file-container" data="${path}" type="application/pdf">
                    <iframe class="file-container" src="${path}" type="application/pdf">
                        This browser does not support PDFs. Please download the XML to view it: <a href="${path}">Download PDF</a>"
                    </iframe>
                </object>`;
        }
        else if (pathLower.includes(".jpg") || pathLower.includes(".jpeg") || pathLower.includes(".gif") || pathLower.includes(".png")) {
            fileContainerHTML =
                `<div class="file-container">
                    <img style='max-width:100%;' src="${path}"/>
                </div>`;
        }
        else if (pathLower.includes(".xml")) {
            fileContainerHTML =
                `<iframe class="file-container" src="${path}" type="text/xml">
                    This browser does not support XMLs. Please download the XML to view it: <a href="${path}">Download XML</a>"
                </iframe>`;
        }
        else if (pathLower.includes(".htm")) {
            var srcPrefixArr = result.metadata_storage_path.split('/');
            srcPrefixArr.splice(-1, 1);
            var srcPrefix = srcPrefixArr.join('/');

            var htmlContent = result.content.replace(/src=\"/gi, `src="${srcPrefix}/`);

            fileContainerHTML =
                `${htmlContent}`;
        }
        else if (pathLower.includes(".mp3")) {
            fileContainerHTML =
                `<audio controls>
                  <source src="${path}" type="audio/mp3">
                  Your browser does not support the audio tag.
                </audio>`;
        }
        else if (pathLower.includes(".mp4")) {
            fileContainerHTML =
                `<video controls class="video-result">
                        <source src="${path}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>`;
        }
        else if (pathLower.includes(".doc") || pathLower.includes(".ppt") || pathLower.includes(".xls")) {
            var src = "https://view.officeapps.live.com/op/view.aspx?src=" + encodeURIComponent(path);

            fileContainerHTML =
                `<iframe class="file-container" src="${src}"></iframe>`;
        }
        else {
            fileContainerHTML =
                `<div>This file cannot be previewed. Download it here to view: <a href="${path}">Download</a></div>`;
        }
    }
    else {
        fileContainerHTML =
            `<div>This file cannot be previewed or downloaded.`;
    }

    return fileContainerHTML;
}

function GetLetterHTML(result) {
    var relatedLetters = [];
    var letterHTML = "";
    var letterResultsHTML = "";
    var letterViewerHTML = "";

    // search for all the related letters by thread id
    var getRelatedLetters = $.post('/home/getdocuments',
        {
            q: `thread_id:${result.thread_id}`,
        },
        function (data) {
            relatedLetters = data.results;
            results = results.concat(data.results);

            var letterArr = [];

            relatedLetters.forEach(function (item, index, array) {
                var letterData = JSON.parse(item.document.metadata);
                var letter = {
                    id: item.document.id,
                    idx: results.indexOf(item),
                    receiver: letterData.receiver,
                    sender: letterData.sender,
                    type: letterData.type,
                    filingPeriod: letterData.filing_period,
                    company: letterData.company,
                    date: Date.parse(letterData.letter_date),
                    dateString: letterData.letter_date,
                    fileNo: letterData.file_no,
                    path: item.document.metadata_storage_path
                }

                letterArr.push(letter);
            });

            letterArr.sort(
                function (a, b) {
                    return a.date - b.date
                });

            letterArr.forEach(function (item, index, array) {

                var letterClass = "letter-result";
                var sender = item.sender != "" ? item.sender : "N/A";

                if (result.metadata_storage_path == item.path) {
                    letterClass += " selected";
                    letterViewerHTML = `<object class="file-container" data="${item.path}" t y pe="application/pdf">
                                <iframe class="file-container" src="${item.path}" type="application/pdf">
                                    This browser does not support PDFs. Please download the XML to view it: <a href="${item.path}">Download PDF</a>"
                                </iframe>
                            </object>`;
                }

                letterResultsHTML += `<div id="letter_${item.idx}" class="${letterClass}" onclick="ShowLetter(${item.idx}, '${item.path}')">
                                        <div class="letter-sender">${sender}</div>
                                        <div class="letter-date">${item.dateString}</div>
                                    </div>`;
            });

            letterHTML = `<div id="letter-thread" class="col-md-3">
                            ${letterResultsHTML}
                        </div>
                        <div id="letter-viewer" class="col-md-9">
                            ${letterViewerHTML}
                        </div>`;

            $('#letters-pivot').html(letterHTML);
        });
}

function GetLetterDetailsHTML(result) {
    var letterDetailsHTML = "";
    var letterData = JSON.parse(result.metadata);

    letterDetailsHTML = `<div><table class="table" style="margin-bottom:0px;">`;

    if (letterData.sender && letterData.sender.length > 0) {
        letterDetailsHTML += `<tr><td>Sender</td><td>${letterData.sender}</td></tr>`;
    }
    if (letterData.receiver && letterData.receiver.length > 0) {
        letterDetailsHTML += `<tr><td>Recipient</td><td>${letterData.receiver}</td></tr>`;
    }
    if (letterData.company && letterData.company.length > 0) {
        letterDetailsHTML += `<tr><td>Company</td><td>${letterData.company}</td></tr>`;
    }
    if (letterData.filing_period && letterData.filing_period.length > 0) {
        letterDetailsHTML += `<tr><td>Filing Period</td><td>${letterData.filing_period}</td></tr>`;
    }
    if (letterData.letter_date && letterData.letter_date.length > 0) {
        letterDetailsHTML += `<tr><td>Date</td><td>${letterData.letter_date}</td></tr>`;
    }
    letterDetailsHTML += `</table></div><hr style="margin-top:0px;" />`;

    return letterDetailsHTML;
}

function GetTagsHTML(result) {
    var tagsHTML = "";

    if ((result.persons && result.persons.length > 0) || (result.locations && result.locations.length > 0) || (result.organizations && result.organizations.length > 0))
        tagsHTML += GetEntityTags(result);

    if (result.keyPhrases && result.keyPhrases.length > 0)
        tagsHTML += GetKeyPhrasesTags(result);

    if (result.risks && result.risks.length > 0)
        tagsHTML += GetRiskTags(result, false);

    return tagsHTML;
}

function GetTagsClickHTML(result) {
    var tagsHTML = "";

    if ((result.persons && result.persons.length > 0) || (result.locations && result.locations.length > 0) || (result.organizations && result.organizations.length > 0))
        tagsHTML += GetEntityTags(result);

    if (result.keyPhrases && result.keyPhrases.length > 0)
        tagsHTML += GetKeyPhrasesTags(result);

    if (result.risks && result.risks.length > 0)
        tagsHTML += GetRiskTags(result, true);

    return tagsHTML;
}

function GetEntityTags(result) {
    var entityTags = "";
    var dedupedEntities = [];
    var peopleCount = 1;
    var locationsCount = 1;
    var orgsCount = 1;

    result.persons.forEach(function (item, index, array) {
        if ($.inArray(item, dedupedEntities) === -1 && peopleCount < 3 && item.length < 50) { //! in array
            dedupedEntities.push(item);
            entityTags += `<button class="tag tag-entities" onclick="HighlightTag(event)">${item}</button>`;
            peopleCount++;
        }
    });

    result.locations.forEach(function (item, index, array) {

        if ($.inArray(item, dedupedEntities) === -1 && locationsCount < 3 && item.length < 50) { //! in array
            dedupedEntities.push(item);
            entityTags += `<button class="tag tag-entities" onclick="HighlightTag(event)">${item}</button>`;
            locationsCount++;
        }
    });

    result.organizations.forEach(function (item, index, array) {
        if ($.inArray(item, dedupedEntities) === -1 && orgsCount < 3 && item.length < 50) { //! in array
            dedupedEntities.push(item);
            entityTags += `<button class="tag tag-entities" onclick="HighlightTag(event)">${item}</button>`;
            orgsCount++;
        }
    });

    return entityTags;
}

function GetKeyPhrasesTags(result) {
    var keyPhrasesTags = "<div>";

    if (result.keyPhrases.length >= 5) {
        result.keyPhrases = result.keyPhrases.slice(0, 5);
    }

    result.keyPhrases.forEach(function (item, index, array) {
        keyPhrasesTags += `<button class="tag tag-entities tag-keyphrases" onclick="HighlightTag(event)">${item}</button>`;
    });
    keyPhrasesTags += "</div>";
    return keyPhrasesTags;
}

function GetRiskTags(result, isClickable) {
    var riskTags = "";
    riskItems.length = 0;

    result.risksDetails.forEach(function (item, index, array) {
        var detail = JSON.parse(item);
        detail.body = detail.body;

        detail.risks.forEach(function (risk, idx, riskArr) {
            var filterResult = riskItems.filter(function (r) { return r.risk === risk; });

            if (filterResult && filterResult.length > 0) {

                filterResult[0].paragraphs.push(detail.body);
            }
            else {
                var riskParagraphs = [detail.body];

                riskItems.push({
                    risk: risk,
                    paragraphs: riskParagraphs
                })
            }
        });
    });

    riskItems.forEach(function (riskItem, index, array) {
        var click = isClickable ? `onclick="HighlightRisk(event, '${riskItem.risk}')"` : "";

        riskTags += `<button id="${riskItem.risk}_${index}" class="tag tag-entities tag-risk" ${click})">${riskItem.risk} (${riskItem.paragraphs.length})</button>`;
    });

    return riskTags;
}

function HighlightTag(tag) {
    var searchText = $(event.target).text();

    if ($(event.target).parents('#tags-panel').length) {
        GetReferences(searchText, false);
    }
    else {
        event.stopPropagation();
        $('#q').append(` ${searchText}`);
        Search();
    }
}

function HighlightRisk(event, risk) {
    var riskItem = riskItems.filter(function (r) { return r.risk === risk; })[0]

    $('#reference-viewer').html("");

    var transcriptHTML = "";
    transcriptText = $('#transcript-viewer-pre').text().replace(/\s/gi, " ").replace(/\&nbsp\;/g, " ").replace(/•/g, "").replace(/\s\s+/g, " ");

    riskItem.paragraphs.forEach(function (item, idx, array) {
        var searchText = item.replace(/\\\\u\w+/g, " ").replace(/\s/gi, " ").replace(/\s\s+/g, " ").replace(/[[\]{}()*+?\\^$|#\&\;]/g, '\\$&');; // replace all whitespace chars with space
        var regex = new RegExp(searchText, 'gi')

        transcriptText = transcriptText.replace(regex, function (str) {
            return `<span id='${idx}_${risk}' class="wk-highlight">${str}</span>`;
        })

        var ln = item.length < 200 ? item.length : 200;
        var excerpt = item.substring(0, ln);
        $('#reference-viewer').append(`<li class='reference list-group-item' onclick='GoToReference("${idx}_${risk}")'><span class='wk-highlight'>${excerpt}</span>...</li>`);
    });

    $('#transcript-viewer-pre').html(transcriptText);
}

function ShowLetter(idx, path) {
    var letter = results[idx].document;

    var letterViewerHTML = `<object class="file-container" data="${path}" type="application/pdf">
                                <iframe class="file-container" src="${path}" type="application/pdf">
                                    This browser does not support PDFs. Please download the XML to view it: <a href="${path}">Download PDF</a>"
                                </iframe>
                            </object>`;

    var transcriptContainerHTML = `${letter.content.trim()}`;
    var detailsHTML = GetLetterDetailsHTML(letter);
    var tagContainerHTML = GetTagsHTML(letter);

    // Sets letters-pivot content
    $('#transcript-viewer-pre').html(transcriptContainerHTML);
    $('#details-viewer').html(detailsHTML).css("display", "block");
    $('#letter-viewer').html(letterViewerHTML);
    $('#tag-viewer').html(tagContainerHTML);
    $('#reference-viewer').html("");
    $('#letter_' + idx).addClass('selected').siblings().removeClass('selected');
}

function GetSearchReferences(q) {
    var copy = q;

    copy = copy.replace(/~\d+/gi, "");
    matches = GetMatches(copy, /\w+/gi, 0);

    matches.forEach(function (match) {
        GetReferences(match, true);
    });
}

function SearchTranscript(searchText) {
    $('#reference-viewer').html("");

    if (searchText !== "") {
        // get whole phrase
        GetReferences(searchText, false);
    }
}

function GetReferences(searchText, allowMultiple) {
    var transcriptText;

    if (!allowMultiple) {
        $('#reference-viewer').html("");
        transcriptText = $('#transcript-viewer-pre').text();
    }
    else {
        transcriptText = $('#transcript-viewer-pre').html();
    }

    // find all matches in transcript
    var regex = new RegExp(searchText, 'gi')

    var i = -1;
    var response = transcriptText.replace(regex, function (str) {
        i++;
        var shortname = str.slice(0, 20).replace(/[^a-zA-Z ]/g, " ").replace(new RegExp(" ", 'g'), "_");
        return `<span id='${i}_${shortname}' class="wk-highlight">${str}</span>`;
    })

    $('#transcript-viewer-pre').html(response);

    // for each match, select prev 50 and following 50 characters and add selections to list
    var transcriptCopy = transcriptText;

    // Calc height of reference viewer
    var contentHeight = $('.ms-Pivot-content').innerHeight();
    var tagViewerHeight = $('#tag-viewer').innerHeight();
    var detailsViewerHeight = $('#details-viewer').innerHeight();

    $('#reference-viewer').css("height", contentHeight - tagViewerHeight - detailsViewerHeight - 110)


    $.each(transcriptCopy.match(regex), function (index, value) {

        var startIdx;
        var ln = 400;

        if (value.length > 150) {
            startIdx = transcriptCopy.indexOf(value);
            ln = value.length;
        }
        else {
            if (transcriptCopy.indexOf(value) < 200) {
                startIdx = 0;
            }
            else {
                startIdx = transcriptCopy.indexOf(value) - 200;
            }

            ln = 400 + value.length;
        }

        var reference = transcriptCopy.substr(startIdx, ln);
        transcriptCopy = transcriptCopy.replace(value, "");

        reference = reference.replace(value, function (str) {
            return `<span class="wk-highlight">${str}</span>`;
        });

        var shortName = value.slice(0, 20).replace(/[^a-zA-Z ]/g, " ").replace(new RegExp(" ", 'g'), "_");
        $('#reference-viewer').append(`<li class='reference list-group-item' onclick='GoToReference("${index}_${shortName}")'>...${reference}...</li>`);
    });
}

function GoToReference(selector) {
    // show transcript
    $('#file-pivot-link').removeClass('is-selected');
    $('#letters-pivot-link').removeClass('is-selected');
    $('#transcript-pivot-link').addClass('is-selected');

    $('#file-pivot').css('display', 'none');
    $('#letters-pivot').css('display', 'none');
    $('#transcript-pivot').css('display', 'block');

    var container = $('#transcript-viewer');
    var scrollTo = $("#" + selector);

    container.animate({
        scrollTop: scrollTo.offset().top - container.offset().top + container.scrollTop()
    });
}

function InitLayout() {

    if (flag === true) {
        $grid.masonry('destroy'); // destroy
    }

    $grid.masonry({
        itemSelector: '.results-div',
        columnWidth: '.results-sizer'
    });

    $grid.imagesLoaded().progress(function () {
        $grid.masonry('layout');
    });

    flag = true;
}

function FabricInit() {
    var CheckBoxElements = document.querySelectorAll(".ms-CheckBox");
    for (var i = 0; i < CheckBoxElements.length; i++) {
        new fabric['CheckBox'](CheckBoxElements[i]);
    }
}

function SampleSearch(text) {
    $('#index-search-input').val(text);
    $('#index-search-submit').click();
}

function htmlEncode(value) {
    return $('<div/>').text(value).html();
}

function htmlDecode(value) {
    return $('<div/>').html(value).text();
}

function AddRecentDocument(result) {
    $.post('/home/updaterecentdocuments',
        {
            title: result.filename,
            filePath: result.metadata_storage_path,
            companyName: result.company,
            exhibitType: result.exhibitType,
            filingType: result.filingType,
            fileType: result.fileType,
            id: result.id
        },
        function (data) {
        });
}

function ShowUserInfo() {
    ShowRecentDocuments();
    ShowRecentSearches();
}

function ShowRecentDocuments() {
    $('#documents-loading-indicator').show();

    $.post('/home/getrecentdocuments',
        {

        },
        function (data) {
            $('#documents-loading-indicator').css("display", "none");
            UpdateRecentDocuments(data);
        });
}

function UpdateRecentDocuments(data) {
    var recentDocsHtml = '';

    //loop through tempdata with 
    var limit = 5;
    if (data.length < 5) {
        limit = data.length;
    }
    for (var i = 0; i < limit; i++) {

        var documentName = data[i].companyName;
        var accessedDate = new Date(data[i].accessedDate);
        var fileType = data[i].fileType;
        var id = data[i].documentID;

        var icon = "ms-Icon--Page";;

        if (fileType != null) {
            if (fileType.includes("PDF")) {
                icon = "ms-Icon--PDF";
            }
            else if (fileType.includes("HTM")) {
                icon = "ms-Icon--FileHTML";
            }
            else if (fileType.includes("XML")) {
                icon = "ms-Icon--FileCode";
            }
            else if (fileType.includes("DOC")) {
                icon = "ms-Icon--WordDocument";
            }
            else if (fileType.includes("PPT")) {
                icon = "ms-Icon--PowerPointDocument";
            }
            else if (fileType.includes("XLS")) {
                icon = "ms-Icon--ExcelDocument";
            }
        }


        // generate document buttons w/ queries to docs
        recentDocsHtml += `<button style="font-size:16px;" class="recentdocument" onclick="SampleSearch('${id}')"><i class="html-icon ms-Icon ${icon}"></i>${documentName}
                                    <span class="recentdocument-date">${accessedDate.toLocaleDateString()} ${accessedDate.toLocaleTimeString()}</span>
                                </button>`;
    }

    // return html with buttons
    $("#recent-documents").html(recentDocsHtml);

}

function ShowRecentSearches() {
    $('#searches-loading-indicator').show();

    $.post('/home/getsearchqueries',
        {

        },
        function (data) {
            $('#searches-loading-indicator').css("display", "none");

            UpdateRecentSearches(data);
        });
}

function UpdateRecentSearches(data) {
    var recentSearchesHtml = '';
    //loop through tempdata with
    for (var i = 0; i < 5; i++) {

        var searchQuery = data[i].query;
        var searchDate = new Date(data[i].searchDate);
        var searchQueryShort = searchQuery;
        if (searchQuery.length > 30) {
            searchQueryShort = searchQueryShort.substring(0, 30);
            searchQueryShort += "...";
        }

        // generate document buttons w/ queries to docs
        recentSearchesHtml += `<button style="font-size:16px;" class="recentsearch" onclick="SampleSearch('${searchQuery}')">${searchQueryShort}
                                    <div class="recentsearchdate">${searchDate.toLocaleDateString()} ${searchDate.toLocaleTimeString()}</div>
                                </button>`;

        // return html with buttons
        $("#recent-searches").html(recentSearchesHtml);
    }
}