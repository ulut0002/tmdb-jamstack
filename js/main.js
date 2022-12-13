"use strict";

const log = console.log;

//Utility functions
const UTILITY = {
  addParamToURL: function (target, value) {
    if (!value) return target;
    return target + APP.URL_SEPARATOR + encodeURIComponent(value);
  },
  createImagePath: function (posterPath, size) {
    if (!posterPath) return "./images/image not found.jpeg";
    // const size = "w500";
    return `https://image.tmdb.org/t/p/${size}/${posterPath}`;
  },
  createCreditsURL: function (movie) {
    //  credits.html#/movie/[ID]/credits
    let urlBase = `./credits.html#`;
    if (!movie) return urlBase;

    urlBase =
      urlBase +
      APP.URL_SEPARATOR +
      movie._type +
      APP.URL_SEPARATOR +
      movie.id +
      APP.URL_SEPARATOR +
      movie._searchTerm;
    return urlBase;
  },

  sortCastArrByPopularity(arr) {
    //sort descending
    if (!arr) return arr;
    arr.sort((a, b) => {
      if (!a.popularity) return -1;
      if (!b.popularity) return +1;
      return a.popularity < b.popularity ? +1 : 0;
    });
    return arr;
  },
};

const APP = {
  pageID: undefined,
  URL_SEPARATOR: "/",
  init: function () {
    PAGE.init();
    window.addEventListener("popstate", PAGE.popHandler);
    if (!location.hash) {
      history.replaceState({}, null, `${PAGE.currentPageShortURL}#`);
      if (PAGE.DOM.selectTV) PAGE.DOM.selectTV.checked = true;
      //TODO: display a generic message in result container
    } else {
      PAGE.firePopSearch();
    }
  },
};

// SEARCH object is a stand-alone object
// use "params" to store search parameters
// use "callback" to store function pointers
// call "performSearch" only after setting the "params" and "callback" variables
const SEARCH = {
  api: {
    key: `012e36aa22f85eee73b43fe2627eb4e1`,
    baseURL: "https://api.themoviedb.org",
    movieSearchURL: "/3/search/movie",
    tvSearchURL: "/3/search/tv",
    movieCreditsURL: "/3/movie/[ID]/credits",
    tvCreditsURL: "/3/tv/[ID]/credits",
  },
  params: {
    searchMovie: false,
    searchTV: false,
    searchMovieCredit: false,
    searchTVCredit: false,
    keyword: "",
    requestedPage: 1,
    movieShowID: 0,
    fromFormHandler: false,
  },
  callback: {
    success: undefined,
    fail: undefined,
  },

  init: function () {
    SEARCH.params.searchTVCredit = false;
    SEARCH.params.searchMovieCredit = false;
    SEARCH.params.searchTV = false;
    SEARCH.params.searchMovie = false;
    SEARCH.params.keyword = "";
    SEARCH.params.requestedPage = 1;
    SEARCH.params.movieShowID = 0;
    SEARCH.params.fromFormHandler = false;
    SEARCH.callback.fail = undefined;
    SEARCH.callback.success = undefined;
  },

  performSearch: function () {
    //clear result container
    PAGE.setInnerHTML(PAGE.DOM.resultContainer, "");
    //depending on selection, perform the Show or Credit search
    if (PAGE.isMainPage() && SEARCH.isMovieShowSearch()) {
      SEARCH.performShowSearch();
    } else if (PAGE.isCreditsPage() && SEARCH.isCreditSearch()) {
      SEARCH.performCreditSearch();
    } else {
      //
    }
  },
  isMovieShowSearch: function () {
    return SEARCH.params.searchMovie || SEARCH.params.searchTV;
  },
  isCreditSearch: function () {
    return SEARCH.params.searchTVCredit || SEARCH.params.searchMovieCredit;
  },
  getIdentifier: function () {
    if (SEARCH.params.searchMovie || SEARCH.params.searchMovieCredit)
      return "movie";
    if (SEARCH.params.searchTV || SEARCH.params.searchTVCredit) return "tv";
  },
  getRequestedPage: function (val) {
    const page = parseInt(val);
    if (!page || page <= 0 || page > 1000) return 1;
    return page;
  },
  performShowSearch: function () {
    const page = SEARCH.getRequestedPage(SEARCH.params.requestedPage);
    const completeURL =
      SEARCH.api.baseURL +
      (SEARCH.params.searchMovie
        ? SEARCH.api.movieSearchURL
        : SEARCH.api.tvSearchURL);
    let url = new URL(completeURL);
    url.searchParams.append("page", page);
    url.searchParams.append("query", SEARCH.params.keyword);
    url.searchParams.append("api_key", SEARCH.api.key);
    SEARCH.doFetch(url);
  },
  performCreditSearch: function () {
    let completeURL =
      SEARCH.api.baseURL +
      (SEARCH.params.searchMovieCredit
        ? SEARCH.api.movieCreditsURL
        : SEARCH.api.tvCreditsURL);
    completeURL = completeURL.replace("[ID]", SEARCH.params.movieShowID);

    let url = new URL(completeURL);
    url.searchParams.append("api_key", SEARCH.api.key);
    SEARCH.doFetch(url);
  },
  doFetch: function (url) {
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("Bad Request", response.body);
        return response.json();
      })
      .then((data) => {
        if (SEARCH.callback.success) {
          SEARCH.callback.success(data);
        } else {
          console.warn("Callback not found!");
          console.log(data);
        }
      })
      .catch((err) => {
        if (SEARCH.callback.fail) {
          SEARCH.callback.fail(err);
        } else {
          console.warn("Callback not found!", err);
        }
      });
  },
};

// represents the current loaded page
const PAGE = {
  currentPageID: "", // main|credits
  currentPageShortURL: "", //index.html | credits.html
  ELEMENTS: {
    ATTR: "data-jamstack",
    RESULT: "result",
    ERROR: "error",
    MESSAGE: "message",
    PAGINATION_CONTAINER: "pagination",
    FORM: "form",
    FORM_SEARCH_TV: "search-tv",
    FORM_SEARCH_MOVIE: "search-movie",
    FORM_SEARCH_TEXT: "search-input",
  },
  DOM: {
    resultContainer: undefined,
    errorContainer: undefined,
    messageContainer: undefined,
    selectTV: undefined,
    selectMovie: undefined,
    inputText: undefined,
    form: undefined,
  },
  PAGE_IDS: {
    main: "index.html",
    credits: "credits.html",
  },
  BODY_IDS: {
    main: "main",
    credits: "credits",
  },
  POSTER_SIZE: "w500",
  PROFILE_SIZE: "w185",
  init: function () {
    //retrieve HTML page elements and other vairables.
    const el = document.querySelector("body");
    if (el && el.hasAttribute("id")) {
      //body id="" attribute will tell us which page we are on
      PAGE.currentPageID = el.attributes.getNamedItem("id").textContent;

      //Based on body-id, decide if you are on "credits.html" or "index.html"
      if (PAGE.currentPageID in PAGE.BODY_IDS)
        PAGE.currentPageShortURL = PAGE.PAGE_IDS[PAGE.currentPageID];

      //read all other dom elements that needs to be manipulated
      PAGE.readDomElements();

      if (PAGE.DOM.form)
        PAGE.DOM.form.addEventListener("submit", PAGE.handleFormSubmit);

      if (PAGE.DOM.selectTV)
        PAGE.DOM.selectTV.addEventListener("change", PAGE.handleRadioSelection);

      if (PAGE.DOM.selectMovie) {
        PAGE.DOM.selectMovie.addEventListener(
          "change",
          PAGE.handleRadioSelection
        );
      }
    } else {
      //error out because something is wrong with the page
    }
  },

  isMainPage: function () {
    return PAGE.currentPageShortURL === PAGE.PAGE_IDS.main;
  },
  isCreditsPage: function () {
    return PAGE.currentPageShortURL === PAGE.PAGE_IDS.credits;
  },
  readDom: function (val, readSingleEl = false) {
    const selector = `[${PAGE.ELEMENTS.ATTR} = ${val}]`;
    return readSingleEl
      ? document.querySelector(selector)
      : document.querySelectorAll(selector);
  },
  readDomElements: function () {
    // data-jamstack="container"
    PAGE.DOM.resultContainer = PAGE.readDom(PAGE.ELEMENTS.RESULT, true);

    // data-jamstack="error"
    PAGE.DOM.errorContainer = PAGE.readDom(PAGE.ELEMENTS.ERROR, true);

    //data-jamstack="message"
    PAGE.DOM.messageContainer = PAGE.readDom(PAGE.ELEMENTS.MESSAGE, true);

    //data-jamstack="form"
    PAGE.DOM.form = PAGE.readDom(PAGE.ELEMENTS.FORM, true);

    //data-jamstack="search-tv"
    PAGE.DOM.selectTV = PAGE.readDom(PAGE.ELEMENTS.FORM_SEARCH_TV, true);

    //data-jamstack="search-movie"
    PAGE.DOM.selectMovie = PAGE.readDom(PAGE.ELEMENTS.FORM_SEARCH_MOVIE, true);

    //data-jamstack="search-input"
    PAGE.DOM.inputText = PAGE.readDom(PAGE.ELEMENTS.FORM_SEARCH_TEXT, true);
  },
  setInnerHTML: function (element, value) {
    if (!element) return;
    if (!value) value = "";
    element.innerHTML = value;
  },
  fireSearch: function (target) {
    //TODO: try-catch
    if (!target) return;

    const formEl = target.closest("form");
    if (!formEl) return;
    if (!PAGE.DOM.inputText) return;

    const selectedFilterEl = formEl.querySelector("input[name=filter]:checked");
    if (!selectedFilterEl) return;
    //movie / tv
    const selectedFilter = selectedFilterEl.value.toString();

    const keywordText = PAGE.DOM.inputText.value.toString().trim();

    if (PAGE.isCreditsPage()) {
      //do something else
      const url = `index.html#/${selectedFilter}/${encodeURIComponent(
        keywordText
      )}/1`;
      location.href = url;
      return;
    }

    SEARCH.init();
    SEARCH.params.searchTV = selectedFilter.includes("tv");
    SEARCH.params.searchMovie = selectedFilter.includes("movie");
    SEARCH.params.requestedPage = 1;
    SEARCH.params.keyword = keywordText;
    SEARCH.params.fromFormHandler = true;
    SEARCH.callback.success = PAGE.displayMovies;
    SEARCH.callback.fail = PAGE.displayError;
    SEARCH.performSearch();

    PAGE.updatePageHash(
      PAGE.currentPageShortURL,
      selectedFilter,
      keywordText,
      1
    );
  },
  handleRadioSelection: function (ev) {
    ev.preventDefault();
    if (PAGE.DOM.form && PAGE.DOM.inputText.value.toString().trim() != "")
      PAGE.fireSearch(ev.currentTarget);
  },
  handleFormSubmit: function (ev) {
    if (ev) ev.preventDefault();
    PAGE.fireSearch(ev.currentTarget);
  },

  displayMovies: function (data) {
    // const currPage = data.page;
    // const totalResults = data.total_results;
    // const totalPages = data.total_pages;
    let buffer = "";
    buffer += data.results.map((show) => PAGE.showToHTML(show)).join("");
    buffer = `<ul>${buffer}</ul>`;
    PAGE.setInnerHTML(PAGE.DOM.resultContainer, buffer);
    //PAGE.updateScreen();
  },
  //the function works for both movies and tv shows

  getPaginationHTML: function (data) {},
  showToHTML(show) {
    if (!show) return "";
    let output = "";
    const title = SEARCH.params.searchTV ? show.name : show.title;
    const type = SEARCH.getIdentifier(); //tv | show

    show._type = type;
    show._title = title;
    show._searchTerm = SEARCH.params.keyword;
    const overview = show.overview ? show.overview : "Overview N/A";
    const voteAverage = show.vote_average
      ? `${show.vote_average} / 10`
      : "Rating N/A";

    output = `
    <li class="show-card shadow-1" data-id="${show.id}" data-type="${type}"> 
        <a class="show-image-link" href="${UTILITY.createCreditsURL(show)}">
          <img class="show-image shadow-1" src="${UTILITY.createImagePath(
            show.poster_path,
            PAGE.POSTER_SIZE
          )}" alt="Feature poster of movie/tv show ${title}"/>
        </a>
        <p class="show-name">${title}</p>
        <p class="show-overview">${overview}</p>
        <div class="show-rating">${voteAverage}</div>
        <div><i class="bi bi-heart icon-color fav-icon fav-no" ></i></div>
        <div><i class="bi bi-heart-fill icon-color fav-icon fav-yes"></i><div>
      </li>`;

    return output;
  },
  isFavorite: function () {},

  displayCredits: function (data) {
    //TODO:
    // console.log("data1", data.cast);
    if (!data) return;
    data.cast = UTILITY.sortCastArrByPopularity(data?.cast);
    data.crew = UTILITY.sortCastArrByPopularity(data?.crew);
    console.log("data2", data.cast);

    let html = "";

    if (data.cast) {
      html += PAGE.creditsToHTML(data.cast, "Cast");
    } else {
      //error text
    }

    if (data.crew) {
      html += PAGE.creditsToHTML(data.cast, "Crew");
    } else {
      //error text
    }
    //log("html", html);
    // if (data.crew)
    PAGE.setInnerHTML(PAGE.DOM.resultContainer, html);
    log("dom", PAGE.DOM.resultContainer);
    //PAGE.creditsToHTML(data.crew, "Crew", "No crew found");
  },
  creditsToHTML: function (data, title) {
    let html = "";
    html = html + `<h1>${title}</h1>`;
    if (Array.isArray(data)) {
      html += data
        .map((item) => {
          return `<li class="show-card" data-id="${item.id}">
             
          <img  src="${UTILITY.createImagePath(
            item?.profile_path,
            PAGE.PROFILE_SIZE
          )}" alt="Feature poster of ${title}"/>
          <p>${item.name}</p>
          <p>${item.popularity}</p>

                  </li>`;
        })
        .join("");
    } else {
      log("not array");
    }
    return html;
  },
  creditToHTML: function (credit) {},
  updateScreen: function () {
    //if the trigger is url, then update the form values
    // PAGE.updateFieldValue(PAGE.DOM.selectTV, "");
    // PAGE.updateFieldValue(PAGE.DOM.selectMovie, "");
    PAGE.updateFieldValue(PAGE.DOM.inputText, SEARCH.params.keyword);
  },
  displayError: function (data) {},

  updateFieldValue: function (elList, val) {
    //works for lists only
    if (!elList) return;
    if (!val) val = "";

    elList.forEach((field) => {
      // log("field", field, "va);
      field.value = val;
    });
  },
  //URL can have up to 4 parameters.
  //For this project, it can have 3 params only.
  readURL: function () {
    let hash = location.hash;
    if (hash) {
      let [, arg1, arg2, arg3, arg4] = hash.split(APP.URL_SEPARATOR);
      arg1 = decodeURI(arg1);
      arg2 = decodeURI(arg2);
      arg3 = decodeURI(arg3);
      arg4 = decodeURI(arg4);
      return { arg1, arg2, arg3, arg4 };
    }
  },
  // @page: index.html or credits.html
  updatePageHash: function (page, p1, p2, p3, p4) {
    let pushURL = `${page}#`;
    pushURL = UTILITY.addParamToURL(pushURL, p1);
    pushURL = UTILITY.addParamToURL(pushURL, p2);
    pushURL = UTILITY.addParamToURL(pushURL, p3);
    pushURL = UTILITY.addParamToURL(pushURL, p4);
    history.pushState({}, "", pushURL);
  },
  popHandler: function (ev) {
    // log("pop");
    PAGE.firePopSearch();
  },
  firePopSearch: function () {
    const urlValues = PAGE.readURL();
    SEARCH.init();
    SEARCH.params.fromFormHandler = false;

    if (PAGE.isMainPage()) {
      SEARCH.params.searchTV = urlValues?.arg1.includes("tv");
      SEARCH.params.searchMovie = urlValues?.arg1.includes("movie");
      SEARCH.params.requestedPage = SEARCH.getRequestedPage(urlValues?.arg3);
      SEARCH.params.keyword = urlValues?.arg2;
      SEARCH.callback.success = PAGE.displayMovies;
    } else if (PAGE.isCreditsPage()) {
      // log("credits");
      SEARCH.params.searchTVCredit = urlValues?.arg1.includes("tv");
      SEARCH.params.searchMovieCredit = urlValues?.arg1.includes("movie");
      SEARCH.params.movieShowID = urlValues?.arg2;
      SEARCH.params.keyword = urlValues?.arg3;
      SEARCH.callback.success = PAGE.displayCredits;
      log(SEARCH.params);
    }
    SEARCH.callback.fail = PAGE.displayError;

    //fill form values
    if (SEARCH.params.searchTV || SEARCH.params.searchTVCredit) {
      if (PAGE.DOM.selectTV) {
        PAGE.DOM.selectTV.checked = true;
      }
    }

    if (SEARCH.params.searchMovie || SEARCH.params.searchMovieCredit) {
      if (PAGE.DOM.selectMovie) {
        PAGE.DOM.selectMovie.checked = true;
      }
    }

    if (PAGE.DOM.inputText) PAGE.DOM.inputText.value = SEARCH.params.keyword;

    //perform search again by using SEARCH object

    SEARCH.performSearch();
  },
};

document.addEventListener("DOMContentLoaded", APP.init);
