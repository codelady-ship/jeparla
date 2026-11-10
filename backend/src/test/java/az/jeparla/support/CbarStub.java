package az.jeparla.support;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;

/**
 * A local stand-in for www.cbar.az (no live calls in tests): answers {@code GET /currencies/dd.MM.yyyy.xml}
 * with what the test programs, and records every request. Bound to 127.0.0.1 on a free port.
 */
public final class CbarStub implements AutoCloseable {

    /** One answer. {@code hold} (optional) is awaited before answering, to keep a request in flight. */
    public record Answer(int status, String contentType, byte[] body, CountDownLatch hold) {

        public static Answer xml(byte[] body) {
            return new Answer(200, "application/xml", body, null);
        }

        public static Answer fixture(String name) {
            return xml(bytes("cbar/" + name));
        }

        public static Answer status(int status) {
            return new Answer(status, "text/html; charset=UTF-8", "<html></html>".getBytes(), null);
        }

        public Answer heldBy(CountDownLatch latch) {
            return new Answer(status, contentType, body, latch);
        }
    }

    /** A recorded request. */
    public record Request(String path, String userAgent, String accept) {
    }

    private final HttpServer server;
    private final List<Request> requests = new CopyOnWriteArrayList<>();
    private volatile Function<String, Answer> answers = path -> Answer.status(404);

    public CbarStub() {
        try {
            server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        server.createContext("/", this::handle);
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();
    }

    /** {@code http://127.0.0.1:port/currencies/{date}.xml}, for {@code jeparla.metal-prices.source-url}. */
    public String sourceUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/currencies/{date}.xml";
    }

    /** Answers every request with the result of {@code answers} for its path. */
    public void answer(Function<String, Answer> answers) {
        this.answers = answers;
    }

    /** Answers every request with the same answer. */
    public void always(Answer answer) {
        answer(path -> answer);
    }

    public List<Request> requests() {
        return List.copyOf(requests);
    }

    public void reset() {
        requests.clear();
        always(Answer.status(404));
    }

    private void handle(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        requests.add(new Request(path, exchange.getRequestHeaders().getFirst("User-Agent"),
                exchange.getRequestHeaders().getFirst("Accept")));
        Answer answer = answers.apply(path);
        try {
            if (answer.hold() != null && !answer.hold().await(30, TimeUnit.SECONDS)) {
                throw new IllegalStateException("stub answer was never released");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        exchange.getResponseHeaders().add("Content-Type", answer.contentType());
        if (answer.status() == 302) {
            exchange.getResponseHeaders().add("Location", "/home");
        }
        exchange.sendResponseHeaders(answer.status(), answer.body().length == 0 ? -1 : answer.body().length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(answer.body());
        } catch (IOException e) {
            // The client gave up (timeout test).
        }
        exchange.close();
    }

    public static byte[] bytes(String classpathResource) {
        try (InputStream in = CbarStub.class.getClassLoader().getResourceAsStream(classpathResource)) {
            if (in == null) {
                throw new IllegalArgumentException("missing test resource " + classpathResource);
            }
            return in.readAllBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
