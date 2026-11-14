package az.jeparla.ai;

import az.jeparla.common.persistence.CreatedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** The seller's decision on a job's result (#55, V40): nothing generated is published without one. */
@Entity
@Table(name = "ai_approvals")
public class AiApproval extends CreatedEntity {

    @Column(name = "job_id", nullable = false, updatable = false, unique = true)
    private Long jobId;

    @Column(name = "asset_id", updatable = false)
    private Long assetId;

    @Column(name = "decision", nullable = false, updatable = false)
    private String decision;

    @Column(name = "decided_by", updatable = false)
    private Long decidedBy;

    protected AiApproval() {
    }

    private AiApproval(long jobId, Long assetId, String decision, Long decidedBy) {
        this.jobId = jobId;
        this.assetId = assetId;
        this.decision = decision;
        this.decidedBy = decidedBy;
    }

    static AiApproval approved(long jobId, long assetId, Long decidedBy) {
        return new AiApproval(jobId, assetId, "APPROVED", decidedBy);
    }

    static AiApproval rejected(long jobId, Long decidedBy) {
        return new AiApproval(jobId, null, "REJECTED", decidedBy);
    }
}
