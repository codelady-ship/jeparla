/**
 * IndexNow (#62, PLAN 5.18): tells Bing, Yandex and the other IndexNow engines (api.indexnow.org) which public
 * pages changed, so they are crawled again soon after a product or store is published, changed or removed.
 *
 * <p>Off unless {@code JEPARLA_INDEXNOW_KEY} is set (the key never lives in the repository; the frontend serves it
 * at {@code /<key>.txt} from the same variable). Committed catalog changes are collected after the transaction,
 * resolved to the public URLs in the three languages and sent in one batch by a background thread after
 * {@code jeparla.indexnow.delay}, so the site's own cache already shows the change. A request never waits for
 * IndexNow, and a failed submission is retried a limited number of times.
 */
package az.jeparla.indexnow;
