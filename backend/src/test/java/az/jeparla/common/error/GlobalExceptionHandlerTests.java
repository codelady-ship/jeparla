package az.jeparla.common.error;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.common.TestEndpoints;
import az.jeparla.support.WithPostgres;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@WithPostgres
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestEndpoints.class)
class GlobalExceptionHandlerTests {

    private static final String INVALID_BODY = "{\"name\": \" \", \"code\": \"x\"}";

    @Autowired
    private MockMvc mockMvc;

    private ResultActions postInvalid(String language) throws Exception {
        var request = post("/api/v1/test/echo").contentType(MediaType.APPLICATION_JSON).content(INVALID_BODY);
        if (language != null) {
            request.header(HttpHeaders.ACCEPT_LANGUAGE, language);
        }
        return mockMvc.perform(request)
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.instance").value("/api/v1/test/echo"))
                .andExpect(jsonPath("$.errors", hasSize(2)))
                .andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("name", "code")));
    }

    @Test
    void validationErrorIsLocalizedInAzerbaijani() throws Exception {
        postInvalid("az")
                .andExpect(jsonPath("$.title").value("Yanlış sorğu"))
                .andExpect(jsonPath("$.detail").value("Sorğuda yanlış doldurulmuş sahələr var."))
                .andExpect(jsonPath("$.errors[*].message",
                        containsInAnyOrder("Bu sahə boş ola bilməz.", "Uzunluq 2 ilə 10 arasında olmalıdır.")));
    }

    @Test
    void validationErrorIsLocalizedInEnglish() throws Exception {
        postInvalid("en-US,en;q=0.9")
                .andExpect(jsonPath("$.title").value("Bad request"))
                .andExpect(jsonPath("$.detail").value("Some fields in the request are invalid."))
                .andExpect(jsonPath("$.errors[*].message",
                        containsInAnyOrder("This field must not be blank.", "Length must be between 2 and 10.")));
    }

    @Test
    void validationErrorIsLocalizedInRussian() throws Exception {
        postInvalid("ru-RU,ru;q=0.9")
                .andExpect(jsonPath("$.title").value("Неверный запрос"))
                .andExpect(jsonPath("$.errors[*].message",
                        containsInAnyOrder("Это поле не может быть пустым.", "Длина должна быть от 2 до 10.")));
    }

    @Test
    void defaultsToAzerbaijaniWithoutOrWithUnsupportedLanguage() throws Exception {
        postInvalid(null).andExpect(jsonPath("$.title").value("Yanlış sorğu"));
        postInvalid("de-DE").andExpect(jsonPath("$.title").value("Yanlış sorğu"));
    }

    @Test
    void malformedJsonIsProblemDetail() throws Exception {
        mockMvc.perform(post("/api/v1/test/echo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.ACCEPT_LANGUAGE, "en")
                        .content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Bad request"))
                .andExpect(jsonPath("$.detail").value("The request is invalid or cannot be read."));
    }

    @Test
    void unknownPathIsLocalizedNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/does-not-exist").header(HttpHeaders.ACCEPT_LANGUAGE, "az"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Tapılmadı"));
    }

    @Test
    void unexpectedErrorDoesNotLeakInternals() throws Exception {
        mockMvc.perform(get("/api/v1/test/boom").header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
                .andExpect(status().isInternalServerError())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Internal error"))
                .andExpect(content().string(not(containsString("must not leak"))));
    }
}
