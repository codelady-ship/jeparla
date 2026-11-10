package az.jeparla.search;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Synonyms the admin manages; search reads them in {@link SearchTermsQuery}. */
public interface SearchSynonymRepository extends JpaRepository<SearchSynonym, Long> {

    /** Admin list filtered by a folded part of either side. */
    Page<SearchSynonym> findByTermFoldedContainingOrSynonymFoldedContaining(String termPart, String synonymPart,
            Pageable pageable);

    /** The pair in either order (the search uses it in both directions), other than {@code exceptId}. */
    @Query("""
            select count(s) > 0 from SearchSynonym s
            where s.id <> :exceptId
              and ((s.termFolded = :a and s.synonymFolded = :b) or (s.termFolded = :b and s.synonymFolded = :a))
            """)
    boolean existsPair(@Param("a") String foldedA, @Param("b") String foldedB, @Param("exceptId") long exceptId);
}
