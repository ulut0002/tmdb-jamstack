import { NetworkError, delay, WebError } from "./utils.js";
const log = console.log;

//Utility functions
const UTILITY = {
  addParamToURL: function (target, value) {
    if (!value) return target;
    return target + APP.URL_SEPARATOR + encodeURIComponent(value);
  },
  createImagePath: function (posterPath = "", size = "w500") {
    if (!posterPath) return "../images/image not found.jpeg";
    return `https://image.tmdb.org/t/p/${size}/${posterPath}`;
  },
  generateIndexURL: function (selectedFilter, keywordText, page) {
    //example:  index.html#/tv|movie/keyword/1|2|3
    if (!page) page = 1;
    if (!keywordText) keywordText = "";
    return (
      `index.html#` +
      APP.URL_SEPARATOR +
      selectedFilter +
      APP.URL_SEPARATOR +
      encodeURIComponent(keywordText) +
      APP.URL_SEPARATOR +
      page
    );
  },
  generateCreditsURL: function (movieObj) {
    //example:  credits.html#/movie/[ID]/credits
    let urlBase = `./credits.html#`;
    if (!movieObj) return urlBase;

    urlBase =
      urlBase +
      APP.URL_SEPARATOR +
      movieObj._type +
      APP.URL_SEPARATOR +
      movieObj.id +
      APP.URL_SEPARATOR +
      movieObj._searchTerm +
      APP.URL_SEPARATOR +
      encodeURIComponent(movieObj._title);
    return urlBase;
  },

  sortCastArrByPopularity(arr) {
    //CAST is sorted by popularity, descending
    if (!arr) return arr;
    arr.sort((a, b) => {
      if (!a.popularity) return 1;
      if (!b.popularity) return -1;
      if (a.popularity === b.popularity) return 0;
      return a.popularity < b.popularity ? 1 : -1;
    });
    return arr;
  },
};

const APP = {
  URL_SEPARATOR: "/",
  init: function () {
    //init PAGE object, read  DOM variables and register events
    PAGE.init();

    window.addEventListener("popstate", PAGE.popHandler);

    if (!location.hash) {
      history.replaceState({}, null, `${PAGE.CURRENT.shortURL}#`);
      DOM.selectTV.checked = DOM.selectTV;
      DOM.setInnerHTML(DOM.messageContainer, PAGE.MESSAGES.WELCOME);
    } else {
      //if the page has hash, then fire the search right away.
      //if it is a bad search, it will display an error
      //if it is a good search, then what is searched will depend on which page the user is on.
      PAGE.firePopSearch();
    }
  },
};

// SEARCH_PARAMS object is used by the SEARCH object.
// Whether the search is triggered by the form, direct page access, or popHandler,
// the SEARCH_PARAMS will hold the parameters.
const SEARCH_PARAMS = {
  searchMovie: false,
  searchTV: false,
  searchMovieCredit: false,
  searchTVCredit: false,
  keyword: "",
  requestedPage: 1,
  movieShowID: 0,

  init: function () {
    SEARCH_PARAMS.searchTVCredit = false;
    SEARCH_PARAMS.searchMovieCredit = false;
    SEARCH_PARAMS.searchTV = false;
    SEARCH_PARAMS.searchMovie = false;
    SEARCH_PARAMS.keyword = "";
    SEARCH_PARAMS.requestedPage = 1;
    SEARCH_PARAMS.movieShowID = 0;
  },
  isMovieSearch: function () {
    return SEARCH_PARAMS.searchMovie || SEARCH_PARAMS.searchTV;
  },
  isCreditSearch: function () {
    return SEARCH_PARAMS.searchTVCredit || SEARCH_PARAMS.searchMovieCredit;
  },
};

// SEARCH object is a stand-alone object
// it uses SEARCH_PARAMS to conduct the search, and then
// uses "callback" object to call success and fail functions.
// call "execute" only after setting the "params" and "callback" variables
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
    fromFormHandler: false,
  },
  callback: {
    //fetch() callback functions are set externally
    success: undefined,
    fail: undefined,
  },

  init: function () {
    SEARCH.params.fromFormHandler = false;
    SEARCH.callback.fail = undefined;
    SEARCH.callback.success = undefined;
  },

  execute: function () {
    DOM.cleanContainers();

    if (PAGE.isMainPage() && SEARCH_PARAMS.isMovieSearch()) {
      SEARCH_PARAMS.keyword
        ? SEARCH.performShowSearch()
        : DOM.setInnerHTML(DOM.messageContainer, PAGE.MESSAGES.ENTER_MOVIE);
    } else if (PAGE.isCreditsPage() && SEARCH_PARAMS.isCreditSearch()) {
      SEARCH_PARAMS.movieShowID
        ? SEARCH.performCreditSearch()
        : DOM.setInnerHTML(DOM.errorContainer, PAGE.MESSAGES.MOVIE_ID_MISSING);
    } else {
      //This should not happen
      DOM.setInnerHTML(DOM.errorContainer, PAGE.MESSAGES.UNEXPECTED_ERROR_1);
    }
  },

  getIdentifier: function () {
    if (SEARCH_PARAMS.searchMovie || SEARCH_PARAMS.searchMovieCredit)
      return "movie";
    if (SEARCH_PARAMS.searchTV || SEARCH_PARAMS.searchTVCredit) return "tv";
  },
  getRequestedPage: function (val) {
    const page = parseInt(val);
    if (!page || page <= 0 || page > 1000) return 1;
    return page;
  },
  performShowSearch: function () {
    PAGE.readPageURL();
    const page = SEARCH.getRequestedPage(SEARCH_PARAMS.requestedPage);
    const completeURL =
      SEARCH.api.baseURL +
      (SEARCH_PARAMS.searchMovie
        ? SEARCH.api.movieSearchURL
        : SEARCH.api.tvSearchURL);
    let url = new URL(completeURL);
    url.searchParams.append("page", page);
    url.searchParams.append("query", SEARCH_PARAMS.keyword);
    url.searchParams.append("api_key", SEARCH.api.key);
    SEARCH.doFetch(url);
  },
  performCreditSearch: function () {
    let completeURL =
      SEARCH.api.baseURL +
      (SEARCH_PARAMS.searchMovieCredit
        ? SEARCH.api.movieCreditsURL
        : SEARCH.api.tvCreditsURL);
    completeURL = completeURL.replace("[ID]", SEARCH_PARAMS.movieShowID);

    let url = new URL(completeURL);
    url.searchParams.append("api_key", SEARCH.api.key);
    SEARCH.doFetch(url);
  },
  doFetch: function (url) {
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new NetworkError("Bad Request", response);
        return response.json();
      })
      .then((data) => {
        if (SEARCH.callback.success) {
          SEARCH.callback.success(data);
        } else {
          console.warn("Callback not found!");
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

const DOM = {
  body: undefined,
  resultContainer: undefined,
  errorContainer: undefined,
  messageContainer: undefined,
  pageContainer: undefined,
  selectTV: undefined,
  selectMovie: undefined,
  inputText: undefined,

  form: undefined,
  ATTRIBUTE: "data-jamstack",

  init: function () {
    //read all the dom elements
    DOM.body = document.querySelector("body");

    // data-jamstack="container"
    DOM.resultContainer = DOM.getElement(DOM.getAttrSelector("result-header"));

    // data-jamstack="error"
    DOM.errorContainer = DOM.getElement(DOM.getAttrSelector("error"));

    //data-jamstack="message"
    DOM.messageContainer = DOM.getElement(DOM.getAttrSelector("message"));

    //data-jamstack="form"
    DOM.form = DOM.getElement(DOM.getAttrSelector("form"));

    //data-jamstack="search-tv"
    DOM.selectTV = DOM.getElement(DOM.getAttrSelector("search-tv"));

    //data-jamstack="search-movie"
    DOM.selectMovie = DOM.getElement(DOM.getAttrSelector("search-movie"));

    //data-jamstack="search-input"
    DOM.inputText = DOM.getElement(DOM.getAttrSelector("search-input"));

    //there are two pagination elements
    DOM.pageContainer = DOM.getElements(DOM.getAttrSelector("pagination"));

    //add event listeners
    if (DOM.form) DOM.form.addEventListener("submit", PAGE.handleFormSubmit);

    if (DOM.selectTV)
      DOM.selectTV.addEventListener("change", PAGE.handleRadioSelection);

    if (DOM.selectMovie) {
      DOM.selectMovie.addEventListener("change", PAGE.handleRadioSelection);
    }

    DOM.cleanContainers();
  },
  cleanContainers: function () {
    DOM.setInnerHTML(DOM.resultContainer, "");
    DOM.setInnerHTML(DOM.errorContainer, "");
    DOM.setInnerHTML(DOM.messageContainer, "");
    DOM.setArrInnerHTML(DOM.pageContainer, "");
  },
  getAttrSelector(val) {
    return `[${DOM.ATTRIBUTE} = ${val}]`;
  },
  getElement(selector) {
    return document.querySelector(selector);
  },
  getElements(selector) {
    return document.querySelectorAll(selector);
  },
  setInnerHTML: function (element, value) {
    if (!element) return;
    if (!value) value = "";
    element.innerHTML = value;
  },
  setArrInnerHTML: function (element, value) {
    if (!element) return;
    if (!value) value = "";

    element.forEach((el) => {
      el.innerHTML = value;
    });
  },
};

// represents the current loaded page
const PAGE = {
  //CURRENT represents current page
  CURRENT: {
    pageId: undefined,
    shortURL: undefined,
    pageNumber: undefined,
    totalPages: undefined,
    totalResults: undefined,
    isMainPage: undefined,
    isCreditsPage: undefined,
    urlType: undefined, //tv|movie
    urlKeyword: undefined,
  },
  MESSAGES: {
    WELCOME: `<h2 class="welcome--message font-h1">Welcome to JamStack!</h2>
    <h3 class="welcome--message font-h5">Search movies and tv-shows fast!</h3>`,
    ENTER_MOVIE: `<h2 class="clean--margin">Enter a show or movie name</h2>`,
    MOVIE_ID_MISSING: `<h2 class="clean--margin">Invalid request. Movie ID is missing!</h2>`,
    UNEXPECTED_ERROR_1: `<h2 class="clean--margin">An unexpected error happened!</h2>`,
  },
  POSTER_SIZE: "w500",
  PROFILE_SIZE: "w185",
  init: function () {
    DOM.init();

    if (DOM.body && DOM.body.hasAttribute("id")) {
      const id = DOM.body.attributes
        .getNamedItem("id")
        .textContent.toString()
        .toLowerCase();

      PAGE.CURRENT.pageId = id;
      PAGE.CURRENT.isMainPage = id === "main";
      PAGE.CURRENT.isCreditsPage = id === "credits";
      PAGE.CURRENT.shortURL = PAGE.CURRENT.isMainPage
        ? "index.html"
        : "credits.html";

      PAGE.readPageURL();
    } else {
      //error out because something is wrong with the page
    }
  },

  isMainPage: function () {
    return PAGE.CURRENT.isMainPage;
  },
  isCreditsPage: function () {
    return PAGE.CURRENT.isCreditsPage;
  },
  readPageURL: function () {
    if (PAGE.CURRENT.isMainPage) {
      const url = PAGE.readURL();
      if (url) {
        PAGE.CURRENT.urlType = url?.arg1 ? url.arg1 : "tv";
        PAGE.CURRENT.urlKeyword = url?.arg2 ? url.arg2 : "";
        PAGE.CURRENT.pageNumber = url?.arg3 ? url.arg3 : 1;
      }
    } else {
    }
  },

  fireSearch: function (target) {
    // can be triggered by:
    // 1. form-submit
    // 2. radio button selection within the form

    //makes a search and then updates the hash

    if (!target) return;

    const formEl = target.closest("form");
    if (!formEl) return;
    if (!DOM.inputText) return;

    DOM.cleanContainers();

    const selectedFilterEl = formEl.querySelector("input[name=filter]:checked");
    if (!selectedFilterEl) return;
    const selectedFilter = selectedFilterEl.value.toString(); //movie / tv

    const keywordText = DOM.inputText.value.toString().trim();

    //if we are on credits page, a search triggered by form action should simply go back to index.html
    if (PAGE.isCreditsPage()) {
      const url = UTILITY.generateIndexURL(selectedFilter, keywordText, 1);
      location.href = url;
      return;
    }

    //we are on main page.. Trigger it for a tv or movie search.

    SEARCH.init();
    SEARCH_PARAMS.searchTV = selectedFilter.includes("tv");
    SEARCH_PARAMS.searchMovie = selectedFilter.includes("movie");
    SEARCH_PARAMS.requestedPage = 1; //brand new searches always start from page 1
    SEARCH_PARAMS.keyword = keywordText;
    SEARCH.params.fromFormHandler = true;
    SEARCH.callback.success = PAGE.displayMovies;
    SEARCH.callback.fail = PAGE.displayError;
    PAGE.updatePageHash(PAGE.CURRENT.shortURL, selectedFilter, keywordText, 1);
    SEARCH.execute();
  },
  handleRadioSelection: function (ev) {
    ev.preventDefault();
    if (DOM.form && DOM.inputText.value.toString().trim() != "")
      PAGE.fireSearch(ev.currentTarget);
  },
  handleFormSubmit: function (ev) {
    if (ev) ev.preventDefault();
    PAGE.fireSearch(ev.currentTarget);
  },

  buildPagination() {
    let html = "";

    const pages = [];

    pages[0] = PAGE.CURRENT.pageNumber - 2;
    pages[1] = PAGE.CURRENT.pageNumber - 1;
    pages[2] = PAGE.CURRENT.pageNumber;
    pages[3] = PAGE.CURRENT.pageNumber + 1;
    pages[4] = PAGE.CURRENT.pageNumber + 2;
    pages[5] = PAGE.CURRENT.pageNumber + 3;
    pages[6] = PAGE.CURRENT.pageNumber + 4;

    const pages2 = pages.filter((item) => {
      if (item <= 0) return false;
      if (item > PAGE.CURRENT.totalPages) return false;
      return true;
    });

    //max 5 pages to display
    const pagesToDisplay = pages2.filter((item, index) => {
      return index <= 4;
    });
    const firstPage = pagesToDisplay.at(0);
    const lastPage = pagesToDisplay.at(-1);

    const links = [];
    links[0] = UTILITY.generateIndexURL(
      PAGE.CURRENT.urlType,
      PAGE.CURRENT.urlKeyword,
      1
    );

    links[1] = UTILITY.generateIndexURL(
      PAGE.CURRENT.urlType,
      PAGE.CURRENT.urlKeyword,
      Math.max(1, PAGE.CURRENT.pageNumber - 1)
    );

    html = html + `<a class="btn btn-navigation" href=${links[0]}>First</a>`;
    html = html + `<a class="btn btn-navigation" href=${links[1]}>Prev</a>`;

    for (let index = 0; index < pagesToDisplay.length; index++) {
      html =
        html +
        `<a class="btn btn-navigation btn-navigation__large ${
          pagesToDisplay[index] == PAGE.CURRENT.pageNumber
            ? "pagination-active"
            : ""
        }" href=${UTILITY.generateIndexURL(
          PAGE.CURRENT.urlType,
          PAGE.CURRENT.urlKeyword,
          pagesToDisplay[index]
        )}>${pagesToDisplay[index]}</a>`;
    }

    links[2] = UTILITY.generateIndexURL(
      PAGE.CURRENT.urlType,
      PAGE.CURRENT.urlKeyword,
      Math.min(PAGE.CURRENT.pageNumber + 1, PAGE.CURRENT.totalPages)
    );

    links[3] = UTILITY.generateIndexURL(
      PAGE.CURRENT.urlType,
      PAGE.CURRENT.urlKeyword,
      PAGE.CURRENT.totalPages
    );
    html = html + `<a class="btn btn-navigation" href=${links[2]}>Next</a>`;
    html = html + `<a class="btn btn-navigation" href=${links[3]}}>Last</a>`;
    DOM.setArrInnerHTML(DOM.pageContainer, html);
  },

  displayMovies: function (data) {
    PAGE.CURRENT.pageNumber = data.page ? data.page : 1;
    PAGE.CURRENT.totalResults = data.total_results ? data.total_results : 1;
    PAGE.CURRENT.totalPages = data.total_pages ? data.total_pages : 1;
    let buffer = "";
    //built pagination based on this
    if (data.results && data.results.length >= 1) {
      PAGE.buildPagination();

      //build the grid

      buffer += data.results.map((show) => PAGE.showToHTML(show)).join("");
      buffer = `<ul class="show-container">${buffer}</ul>`;
      DOM.setInnerHTML(DOM.resultContainer, buffer);
    } else {
      buffer += `<h2 class="clean--margin">No result found</h2>`;
      DOM.setInnerHTML(DOM.messageContainer, buffer);
    }
  },
  showToHTML(show) {
    if (!show) return "";
    let output = "";
    const title = SEARCH_PARAMS.searchTV ? show.name : show.title;
    const type = SEARCH.getIdentifier(); //tv | show

    show._type = type;
    show._title = title;
    show._searchTerm = SEARCH_PARAMS.keyword;
    let overview = show.overview ? show.overview : "Overview N/A";
    if (overview.length > 250) {
      overview = overview.substr(0, 250) + "....";
    }
    const voteAverage = show.vote_average
      ? `${show.vote_average} / 10`
      : "Rating N/A";

    output = `
    <li class="show-card shadow-1" data-id="${
      show.id
    }" data-type="${type}">        
          <img class="show-image shadow-1" src="${UTILITY.createImagePath(
            show.poster_path,
            PAGE.POSTER_SIZE
          )}" alt="Feature poster of movie/tv show ${title}"/>
        <h2 class="show-name">${title}</h2>
        <p class="show-overview">${overview}</p>
        <div class="show-rating">${voteAverage}</div>
        <div><a class="btn show-card-btn" href="${UTILITY.generateCreditsURL(
          show
        )}">See Cast</a></div>
      </li>`;
    return output;
  },

  creditsToHTML: function (data) {
    let html = "";
    const type = SEARCH.getIdentifier(); //tv | show

    if (Array.isArray(data)) {
      html += data
        .map((item) => {
          let popularity_class = "NA";
          if (item.popularity) {
            if (item.popularity < 10) {
              popularity_class = "low";
            } else if (item.popularity < 30) {
              popularity_class = "medium";
            } else {
              popularity_class = "high";
            }
          }

          const txt = `<li class="credits-card" data-id="${
            item.id
          }  data-type="${type}"">
             
          <img class="credit-image  shadow-1" src="${UTILITY.createImagePath(
            item?.profile_path,
            PAGE.PROFILE_SIZE
          )}" alt="${item.name} profile image"/>
          
          <h2 class="credit__name">${item.name}</h2>
          <p class="credit__character">${
            item.character ? `as ${item.character}` : ""
          }</p>
          <p class="credit__popularity">Popularity: <span class="credit__popularity__score
          credit__popularity__score--${popularity_class}">${
            item.popularity
          }<span></p>
          
          </li>`;
          return txt;
        })
        .join("");
    } else {
      log("not array");
    }
    return html;
  },
  isFavorite: function () {},

  displayCredits: function (data) {
    //TODO:
    if (!data) return;

    data.cast = UTILITY.sortCastArrByPopularity(data?.cast);

    let html = "";

    if (data.cast && data.cast.length >= 1) {
      html += `<h2>Cast</h2>`;

      html += `<ul class="credit-container">`;
      html += PAGE.creditsToHTML(data.cast);
      html += `</ul>`;
      DOM.setInnerHTML(DOM.resultContainer, html);
    } else {
      //error text
      html = "<h2>No cast member found!</h2>";
      DOM.setInnerHTML(DOM.messageContainer, html);
    }
  },

  updateScreen: function () {
    PAGE.updateFieldValue(DOM.inputText, SEARCH_PARAMS.keyword);
  },
  displayError: function (err) {
    if (!err) return;

    DOM.setInnerHTML(DOM.errorContainer, "");

    let errorMessage = "";
    switch (err.name) {
      case "NetworkError":
        errorMessage = `Network Error.`;
        const errStatus = err.status ? err.status : "";
        const errStatusText = err.statusText ? err.statusText : "";
        const errMessage = err.message ? err.message : "";

        //if () errorMessage += ` Status: `

        errorMessage = `Network Error ${errStatus} - ${errStatusText} ${errMessage}`;
        break;
      case "WebError":
        errorMessage = "Web failure. This should not have happened!";
        break;
      default:
        errorMessage = err.message ? err.message : `Error!`;
    }
    DOM.setInnerHTML(DOM.errorContainer, errorMessage);
  },

  updateFieldValue: function (elList, val) {
    //works for lists only
    if (!elList) return;
    if (!val) val = "";

    elList.forEach((field) => {
      field.value = val;
    });
  },
  //URL can have up to 4 parameters.
  //For this project, it can have 3 params only.
  readURL: function () {
    let hash = location.hash;
    if (hash) {
      let [, arg1, arg2, arg3, arg4] = hash.split(APP.URL_SEPARATOR);
      arg1 = decodeURI(arg1 ? arg1 : "");
      arg2 = decodeURI(arg2 ? arg2 : "");
      arg3 = decodeURI(arg3 ? arg3 : "");
      arg4 = decodeURI(arg4 ? arg4 : "");
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
    PAGE.firePopSearch();
  },
  firePopSearch: function () {
    //firePopSearch is triggered by
    //1. popEvent
    //2. URL reload

    const urlValues = PAGE.readURL();
    log("url", urlValues);

    SEARCH.init();
    SEARCH.params.fromFormHandler = false;
    if (PAGE.isMainPage()) {
      SEARCH_PARAMS.searchTV = urlValues?.arg1.includes("tv");
      SEARCH_PARAMS.searchMovie = urlValues?.arg1.includes("movie");
      if (!SEARCH_PARAMS.searchMovie && !SEARCH_PARAMS.searchTV)
        SEARCH_PARAMS.searchMovie = true;
      SEARCH_PARAMS.keyword = urlValues?.arg2;
      if (!SEARCH_PARAMS.keyword) {
        SEARCH_PARAMS.keyword = "";
      }
      SEARCH_PARAMS.requestedPage = SEARCH.getRequestedPage(urlValues?.arg3);
      SEARCH.callback.success = PAGE.displayMovies;
    } else if (PAGE.isCreditsPage()) {
      SEARCH_PARAMS.searchTVCredit = urlValues?.arg1.includes("tv");
      SEARCH_PARAMS.searchMovieCredit = urlValues?.arg1.includes("movie");
      SEARCH_PARAMS.movieShowID = urlValues?.arg2;
      SEARCH_PARAMS.keyword = urlValues?.arg3;
      SEARCH.callback.success = PAGE.displayCredits;
    }
    log("search params", SEARCH_PARAMS);
    SEARCH.callback.fail = PAGE.displayError;

    //fill form values
    if (DOM.selectTV)
      DOM.selectTV.checked =
        SEARCH_PARAMS.searchTV || SEARCH_PARAMS.searchTVCredit;

    if (DOM.selectMovie)
      DOM.selectMovie.checked =
        SEARCH_PARAMS.searchMovie || SEARCH_PARAMS.searchMovieCredit;

    if (DOM.inputText) DOM.inputText.value = SEARCH_PARAMS.keyword;

    SEARCH.execute();
  },
};

document.addEventListener("DOMContentLoaded", APP.init);
