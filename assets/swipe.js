// Handle swipe gestures (credit to jamie smith)

function addSwipeEvent(element, swipeLeftHandler=null, swipeRightHandler=null, swipeUpHandler=null, swipeDownHandler=null) {
    let _xDown, _yDown;

    element.addEventListener(
        'touchstart',
        handleTouchStart,
        false
    );
    element.addEventListener(
        'touchmove',
        handleTouchMove,
        false
    );


    function ignoreSwipe(event) {
        // if some touches come from elements with ignoreswipe class > ignore
        return Array.from(event.touches).some((t) =>
            t.target.classList.contains('noswipe')
        );
    }

    function handleTouchStart(event) {
        if (ignoreSwipe(event)) {
            _xDown = undefined;
            _yDown = undefined;
            return;
        }

        const firstTouch = event.touches[0];
        _xDown = firstTouch.clientX;
        _yDown = firstTouch.clientY;
    }

    function handleTouchMove(event) {
        if (!_xDown || !_yDown) {
            return;
        }

        const xUp = event.touches[0].clientX;
        const yUp = event.touches[0].clientY;

        const xDiff = _xDown - xUp;
        const yDiff = _yDown - yUp;

        if (Math.abs(xDiff) > Math.abs(yDiff)) {
            /*most significant*/
            if (xDiff > 0) {
                /* left swipe */
                console.log('app: left swipe ', true);
                swipeLeftHandler();
            } else {
                /* right swipe */
                console.log('app: right swipe ', true);
                swipeRightHandler();
            }
        } else {
            if (yDiff > 0) {
                /* up swipe */
                console.log('app: up swipe ', true);
                swipeUpHandler();
            } else {
                /* down swipe */
                console.log('app: down swipe ', true);
                swipeDownHandler();
            }
        }

        /* reset values */
        _xDown = null;
        _yDown = null;
    }
}