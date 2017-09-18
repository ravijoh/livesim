function (options, cb) {
  // Call cb() to activate
  const { __qubit: qb } = window
  const { meta, state } = options
  const {
    variationIsControl: isControl,
    variationMasterId: variationId
  } = meta
  let hasFired = false
  let simulating = false
  const bucket = isControl ? 'control' : 'variation'
  const poller = require('@qubit/poller')
  const sendUVEvent = require('@qubit/send-uv-event')
  const $ = require('jquery')
  let hasVideoAdded = []
  
  const raceList = ["Aintree", "Ascot", "Royal Ascot", "Ayr", "Bangor", "Bath", "Beverley", "Brighton", "Carlisle", "Cartmel",
                    "Catterick", "Chelmsford City", "Cheltenham", "Chepstow", "Chester", "Doncaster", "Epsom", "Exeter", "Fakenham",
                    "Ffos Las", "Fontwell", "Goodwood", "Hamilton", "Haydock", "Hereford", "Hexham", "Huntingdon", "Kelso", "Kempton",
                    "Leicester", "Lingfield", "Ludlow", "Market Rasen", "Musselburgh", "Newbury", "Newcastle", "Newmarket", "Newton Abbot",
                    "Nottingham", "Perth", "Plumpton", "Pontefract", "Redcar", "Ripon", "Salisbury", "Sandown", "Sedgefield", "Southwell",
                    "Stratford", "Taunton", "Thirsk", "Towcester", "Uttoxeter", "Warwick", "Wetherby", "Wincanton", "Windsor", "Wolverhampton",
                    "Worcester", "Yarmouth", "York", "Ballinrobe", "Bellewstown", "Clonmel", "Cork", "Curragh", "Down Royal", "Downpatrick",
                    "Dundalk", "Fairyhouse", "Galway", "Gowran Park", "Kilbeggan", "Killarney", "Laytown", "Leopardstown", "Limerick",
                    "Listowel", "Naas", "Navan", "Punchestown", "Roscommon", "Sligo", "Thurles", "Tipperary", "Tramore", "Wexford"]
  
  Date.prototype.yyyymmdd = function() {
    var mm = this.getMonth() + 1
    var dd = this.getDate()
    
    return [this.getFullYear() + '-',
            (mm>9 ? '' : '0') + mm + '-',
            (dd>9 ? '' : '0') + dd
           ].join('')
  }
  
  const playerUtil = {
    getVideoElement : function(raceName, raceTime, raceId, index) {
      var date = new Date();
      const raceDate = date.yyyymmdd()
      const elem = ['<div class="QL-video-wrap"><div ',
                      'class="QL-video-container"', 
                      'course="' + raceName +'"',
                      'time="' + raceTime + '"',
                      'date="' + raceDate + '"',
                      'raceId="' + raceId + '"',
                      'index="' + index + '"',
                      'id="QL_liveSim" bookmaker="Ladbrokes">',
                    '</div></div>'].join("")
      return elem;
    },
    removeVideoElement : function(video) {
      video.remove()
      _QLLiveSim.stopLiveSim()
    },
    getIconElement : function() {
      const elem = ['<div class="QL-videoplay-icon">LiveSim</div>'].join("")
      return elem;
    }
  }
  
  function isHorseRacingPage () {
    return /racing\/horse-racing\/.../i.test(window.location.href)
  }
  
  function checkForHorseRacingPage (cb) {
    if (isHorseRacingPage()) {
      poller(['.wrap-time-name', '.meetings-group:first  h2.meetings > .title'], cb)
    }
  }
  
  function sendEvent(event) {
    sendUVEvent(event, options.meta, {experiment_name: 'T203 - Live Simulation Horse Racing'})
  }
  
  function checkIfUKorIrishCourse($raceTimeName, $todayCourses) {
    const raceNames = $raceTimeName.find('.name')
    const cardList = todayCourses(raceNames)
    let { universal_variable : uv } = window
    const userLogged = uv && uv.user && uv.user.user_id
    
    if(cardList.length && userLogged) {
      loadScript('https://www.racemodlr.com/ladbrokes/live_sim/desktop/', $raceTimeName, $todayCourses)
    }
  }
  
  function isUKOrIrelandRace(raceCourse, todayUKCourses) {
    return todayUKCourses.indexOf(raceCourse) > -1
  }
  
  function todayCourses($todayCourses) {
    const today = $todayCourses.map(function(){ return $.trim($(this).text()) }).get()
    return raceList.filter(function(race, index) { 
      return today.indexOf(race) > -1
    })
  }
  
  function loadScript(url, $raceTimeName, $todayCourses) {
    var script = document.createElement("script")
    script.type = "text/javascript"
    
    if (script.readyState) {  //IE
        script.onreadystatechange = function() {
          if (script.readyState === "loaded" ||
                  script.readyState === "complete"){
              script.onreadystatechange = null
              fire($raceTimeName, $todayCourses)
          }
        }
    } else {  //Others
        script.onload = function() {
            fire($raceTimeName, $todayCourses)
        }
    }
    
    script.src = url
    document.head.appendChild(script)
  }
  
  function fire ($raceTimeName, $todayCourses) {
    if (!hasFired) {
      hasFired = true
      state.set('execution', {
        pollAndFireCompact,
        $raceTimeName,
        $todayCourses
      })
      cb()
    } else {
      pollAndFireCompact($raceTimeName, $todayCourses)
    }
  }
  
  function pollAndFireCompact($raceTimeName, $todayCourses) {
    const raceTimeLength = $raceTimeName.length
    if (raceTimeLength && raceTimeLength > 1) {
      $($raceTimeName).each(function(i) {
        const element = $(this)
        loadPlayerButton(element, $todayCourses, i)
      })
    } else if(raceTimeLength === 1) {
      const element = $($raceTimeName)
      loadPlayerButton(element, $todayCourses)
    }
  }
  
  function togglePlayer(element, raceName, index) {
    hasVideoAdded[index] = false
    const elementParent = element.parent()
    let raceId = elementParent.parent().attr('id').split("-")[2]
    raceId = (typeof raceId === 'undefined') ? '0' : raceId
    const raceTime = element.find('.time').text()
    const raceContainer = elementParent.nextAll('.race-container')
    const liveSimButton = elementParent.find('.QL-videoplay-icon')
    liveSimButton.on('click', (e) => {
      
      if (liveSimButton.hasClass("unclickable")) {
          e.preventDefault()
      } else {
        _QLLiveSim.stopLiveSim()
        
        liveSimButton.addClass("processing")
        //_QLLiveSim.populateLiveSim()
        
        if(!hasVideoAdded[index] && simulating) {
          const video = $('.QL-video-wrap')
          const id = parseInt(video.find('div').attr('index'))
          hasVideoAdded[id] = false
          video.remove()
        }
      
        if(!hasVideoAdded[index]) {
          hasVideoAdded[index] = true
          simulating = true
          
          setTimeout(function(){_QLLiveSim.populateLiveSim()}, 200)
          
          const videoContent = playerUtil.getVideoElement(raceName, raceTime, raceId, index)
          raceContainer.prepend(videoContent)
          sendEvent("t203:desktop-liveSim:video-displayed")
          liveSimButton.addClass('active').removeClass('processing')
          elementParent.find('.wrap-racing-post-nav .small-button.active').trigger('click')
        } else {
          hasVideoAdded[index] = false
          simulating = false
          const video = raceContainer.find('.QL-video-wrap')
          playerUtil.removeVideoElement(video)
          liveSimButton.removeClass('active processing')
        }
      }
    })
  }
  
  function loadPlayerButton (element, $todayCourses, index) {
      const raceName = element.find('.name').text()
      const elementParent = element.parent()
      const videoIcon = playerUtil.getIconElement()
      const todayUKCourses = todayCourses($todayCourses)
      index = (typeof index === 'undefined') ? 0 : index
      
      if(isUKOrIrelandRace(raceName, todayUKCourses)) {
        elementParent.append(videoIcon)
        togglePlayer(element, raceName, index)
      }
  }
  
  checkForHorseRacingPage(checkIfUKorIrishCourse)
  const listener = qb.uv.on('egUser', (egView) => {
    if(simulating) {
      simulating = false
      _QLLiveSim.stopLiveSim()
    }
    checkForHorseRacingPage(checkIfUKorIrishCourse)
  })
  
  uv_listener.push(['on', 'event', function(e) {
      const category = /Racing Post/i.test(e.category)
      const action = /(verdict|tips|video)/i.test(e.action)
      if(simulating && category && action) {
          _QLLiveSim.stopLiveSim()
          const video = $('.QL-video-wrap')
          const id = parseInt(video.find('div').attr('index'))
          hasVideoAdded[id] = false
          video.remove()
      }
  }])
  
  return {
    runAcrossViews: true,
    onActivation: () => qb.ga('Horse Racing - LiveSim', bucket, variationId)
  }
}