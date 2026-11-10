package az.jeparla.search;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SearchSynonymRepository extends JpaRepository<SearchSynonym, Long> {

    /** Rows where either side equals one of the folded query words: one statement per search. */
    @Query("select s from SearchSynonym s where s.termFolded in :words or s.synonymFolded in :words")
    List<SearchSynonym> findTouching(@Param("words") Collection<String> foldedWords);
}
