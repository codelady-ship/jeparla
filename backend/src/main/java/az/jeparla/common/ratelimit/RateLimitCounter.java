package az.jeparla.common.ratelimit;

import java.time.Duration;

/** Fixed-window counter: counts one hit and reports the total of the current window. */
public interface RateLimitCounter {

    /**
     * @param key    counter key (already hashed, no personal data)
     * @param window window length; the window starts with the first hit
     */
    Window hit(String key, Duration window);

    /** The current window without counting a hit; {@link Window#EMPTY} when there is none. */
    Window peek(String key);

    /** Forgets the key: the next hit starts a new window. */
    void reset(String key);

    /**
     * @param count   hits in the current window, including this one
     * @param resetIn time until the window ends
     */
    record Window(long count, Duration resetIn) {

        public static final Window EMPTY = new Window(0, Duration.ZERO);
    }
}
