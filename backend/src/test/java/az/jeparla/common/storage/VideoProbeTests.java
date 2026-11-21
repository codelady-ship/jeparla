package az.jeparla.common.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import az.jeparla.common.storage.VideoProbe.VideoInfo;
import az.jeparla.support.TestVideos;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** The container check of a product video (#117): type by magic numbers, codec, duration and frame size. */
class VideoProbeTests {

    @Test
    void anH264Mp4GivesItsDurationAndFrameSize() {
        assertThat(VideoProbe.probe(TestVideos.mp4(9500, 1080, 1920)))
                .contains(new VideoInfo("video/mp4", 9500, 1080, 1920));
    }

    @Test
    void theIndexOfAPhoneRecordingIsAtTheEndOfTheFile() {
        assertThat(VideoProbe.probe(TestVideos.mp4("mp42", "avc1", 14_980, 720, 1280, true)))
                .contains(new VideoInfo("video/mp4", 14_980, 720, 1280));
    }

    @Test
    void anMp4WithAnotherCodecOrAQuickTimeFileIsNotAccepted() {
        // HEVC, the default of some phones: most browsers on other systems cannot play it.
        assertThat(VideoProbe.probe(TestVideos.mp4("isom", "hvc1", 5000, 1080, 1920, false))).isEmpty();
        assertThat(VideoProbe.probe(TestVideos.mp4("isom", "hev1", 5000, 1080, 1920, false))).isEmpty();
        assertThat(VideoProbe.probe(TestVideos.mp4("qt  ", "avc1", 5000, 1080, 1920, false))).isEmpty();
    }

    @Test
    void anMp4WithoutADurationSaysSo() {
        // A fragmented MP4 keeps its duration elsewhere: the caller refuses what the header does not state.
        Optional<VideoInfo> info = VideoProbe.probe(TestVideos.mp4(0, 640, 360));
        assertThat(info).isPresent();
        assertThat(info.get().durationMs()).isZero();
    }

    @Test
    void aWebmWithVp8Vp9OrAv1GivesItsDurationAndFrameSize() {
        assertThat(VideoProbe.probe(TestVideos.webm(8000, 1280, 720)))
                .contains(new VideoInfo("video/webm", 8000, 1280, 720));
        assertThat(VideoProbe.probe(TestVideos.webm("webm", "V_AV1", 12_345.4, 540, 960)))
                .contains(new VideoInfo("video/webm", 12_345, 540, 960));
        assertThat(VideoProbe.probe(TestVideos.webm("webm", "V_VP8", 1000.0, 320, 240))).isPresent();
    }

    @Test
    void aMatroskaFileOrAnotherCodecIsNotAWebm() {
        assertThat(VideoProbe.probe(TestVideos.webm("matroska", "V_VP9", 8000.0, 1280, 720))).isEmpty();
        assertThat(VideoProbe.probe(TestVideos.webm("webm", "V_MPEG4/ISO/AVC", 8000.0, 1280, 720))).isEmpty();
    }

    @Test
    void aWebmStraightFromARecorderHasNoDuration() {
        Optional<VideoInfo> info = VideoProbe.probe(TestVideos.webm("webm", "V_VP9", null, 1280, 720));
        assertThat(info).isPresent();
        assertThat(info.get().durationMs()).isZero();
    }

    @Test
    void otherFilesAreNotVideos() {
        assertThat(VideoProbe.probe(null)).isEmpty();
        assertThat(VideoProbe.probe(new byte[0])).isEmpty();
        assertThat(VideoProbe.probe("<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>"
                .getBytes(StandardCharsets.UTF_8))).isEmpty();
        // A file that only starts like an MP4: no index, so no video track.
        byte[] onlyHeader = Arrays.copyOf(TestVideos.mp4(5000, 640, 360), 24);
        assertThat(VideoProbe.probe(onlyHeader)).isEmpty();
    }

    @Test
    void aTruncatedOrDamagedFileNeverThrows() {
        for (byte[] file : new byte[][] {TestVideos.mp4("mp42", "avc1", 5000, 640, 360, true),
                TestVideos.webm(5000, 640, 360)}) {
            for (int length = 0; length < file.length; length++) {
                byte[] cut = Arrays.copyOf(file, length);
                assertThatCode(() -> VideoProbe.probe(cut)).doesNotThrowAnyException();
            }
            for (int at = 0; at < file.length; at++) {
                byte[] damaged = file.clone();
                damaged[at] = (byte) 0xFF;
                assertThatCode(() -> VideoProbe.probe(damaged)).doesNotThrowAnyException();
            }
        }
    }

    /** The clips the site itself ships (docs/credits.md): files written by a real encoder, not by this test. */
    @Test
    void realEncoderOutputIsRead() throws IOException {
        Path media = Path.of("..", "frontend", "public", "media", "ring");
        assumeTrue(Files.isRegularFile(media.resolve("mobile.mp4")), "frontend clips are not checked out");

        Optional<VideoInfo> mp4 = VideoProbe.probe(Files.readAllBytes(media.resolve("mobile.mp4")));
        assertThat(mp4).isPresent();
        assertThat(mp4.get().contentType()).isEqualTo("video/mp4");
        assertThat(mp4.get().durationMs()).isBetween(7_000L, 9_000L);
        assertThat(mp4.get().width()).isPositive();
        assertThat(mp4.get().height()).isPositive();

        Optional<VideoInfo> webm = VideoProbe.probe(Files.readAllBytes(media.resolve("mobile.webm")));
        assertThat(webm).isPresent();
        assertThat(webm.get().contentType()).isEqualTo("video/webm");
        assertThat(webm.get().durationMs()).isBetween(7_000L, 9_000L);
        assertThat(webm.get().width()).isEqualTo(mp4.get().width());
        assertThat(webm.get().height()).isEqualTo(mp4.get().height());
    }
}
