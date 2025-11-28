use anyhow::{Context, Result};
use csv::StringRecord;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, fs::File, path::PathBuf};

#[derive(Serialize)]
struct ClaimEntry {
    amount: String,
    leaf_index: usize,
}

#[derive(Serialize)]
struct AirdropData {
    merkle_root: [u8; 32],
    merkle_tree: Vec<[u8; 32]>,
    claims: BTreeMap<String, ClaimEntry>,
}

pub fn create_airdrop(csv_path: &PathBuf) -> Result<()> {
    let (leaves, addresses, amounts) = parse_airdrop_csv(csv_path)?;
    let merkle_tree = construct_merkle_tree(leaves);
    let leaf_offset = merkle_tree.len() / 2;

    write_airdrop_json(&merkle_tree, &addresses, &amounts, leaf_offset)?;
    Ok(())
}

/// Compute sha256 hash of bytes
fn hash(data: &[u8]) -> [u8; 32] {
    let digest = Sha256::digest(data);
    let mut out = [0u8; 32];
    out.copy_from_slice(&digest);
    out
}

/// Hash two 32-byte child nodes into one parent hash.
fn hash_children(left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(left);
    hasher.update(right);
    let digest = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&digest);
    out
}

/// Calculate the minimum power of 2 greater than or equal to 'num_leaves'
fn min_power_of_2(num_leaves: usize) -> usize {
    let mut num = 1;
    let mut power = 0;

    while num < num_leaves {
        num *= 2;
        power += 1;
    }

    power
}

/// Parse airdrop CSV leaves
fn parse_airdrop_csv(csv_path: &PathBuf) -> Result<(Vec<[u8; 32]>, Vec<String>, Vec<String>)> {
    let file = File::open(csv_path).with_context(|| format!("Failed to open {:?}", csv_path))?;
    let mut rdr = csv::Reader::from_reader(file);

    // Expect header address,amount
    let mut leaves = Vec::new();
    let mut addresses = Vec::new();
    let mut amounts = Vec::new();

    for result in rdr.records() {
        let record: StringRecord = result?;
        let address = record.get(0).context("missing address field")?;
        let amount = record.get(1).context("missing amount field")?;
        // Parse amount as u64 and encode in little-endian like the on-chain program
        let amount_u64: u64 = amount.parse().with_context(|| format!("invalid amount '{}'", amount))?;
        let leaf_bytes = [address.as_bytes(), &amount_u64.to_le_bytes()].concat();
        leaves.push(hash(&leaf_bytes));
        addresses.push(address.to_string());
        amounts.push(amount.to_string());
    }

    if leaves.is_empty() {
        anyhow::bail!("CSV contains no rows");
    }

    Ok((leaves, addresses, amounts))
}

/// Construct the merkle tree
fn construct_merkle_tree(mut leaves: Vec<[u8; 32]>) -> Vec<[u8; 32]> {
    let power = min_power_of_2(leaves.len());
    let tree_levels = power + 1;
    let tree_leaf_nodes = usize::pow(2, power as u32);
    let mut tree = vec![[0u8; 32]; usize::pow(2, tree_levels as u32)];

    while leaves.len() < tree_leaf_nodes {
        leaves.push([0u8; 32]);
    }

    for i in 0..tree_leaf_nodes {
        tree[i + tree_leaf_nodes] = leaves[i];
    }

    for i in (1..tree_leaf_nodes).rev() {
        tree[i] = hash_children(&tree[i * 2], &tree[i * 2 + 1]);
    }

    tree
}

/// Create merkle tree output file
fn write_airdrop_json(
    tree: &[[u8; 32]],
    addresses: &[String],
    amounts: &[String],
    leaf_offset: usize,
) -> Result<()> {
    let file = File::create("airdrop.json").with_context(|| "Failed to create airdrop.json")?;
    let merkle_root = tree[1];

    let mut claims = BTreeMap::new();

    for (i, (addr, amount)) in addresses.iter().zip(amounts).enumerate() {
        let leaf_index = i + leaf_offset;
        claims.insert(
            addr.clone(),
            ClaimEntry {
                amount: amount.to_string(),
                leaf_index,
            },
        );
    }

    let data = AirdropData {
        merkle_root,
        claims,
        merkle_tree: tree.to_vec(),
    };
    serde_json::to_writer_pretty(file, &data).with_context(|| "Failed to write Airdrop JSON")?;
    Ok(())
}

#[allow(dead_code)]
fn create_proof(tree: &[[u8; 32]], leaf_index: usize) -> Vec<[u8; 32]> {
    let mut proof = Vec::new();
    let mut index = leaf_index;

    while index > 1 {
        let sibling_index = if index % 2 == 0 { index + 1 } else { index - 1 };
        proof.push(tree[sibling_index]);
        index /= 2;
    }

    proof
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MerkleTreeTestData {
        merkle_tree: Vec<[u8; 32]>,
        leaves: Vec<[u8; 32]>,
    }

    fn example_merkle_tree1() -> MerkleTreeTestData {
        let leaf1 = [
            232, 15, 182, 90, 199, 3, 132, 189, 139, 171, 3, 88, 214, 11, 124, 190, 150, 222, 91,
            45, 231, 192, 149, 224, 216, 105, 88, 82, 233, 198, 115, 175,
        ];
        let leaf2 = [
            220, 96, 196, 202, 71, 96, 102, 23, 158, 19, 147, 24, 168, 148, 204, 170, 123, 211, 7,
            49, 137, 228, 248, 5, 149, 5, 128, 79, 0, 135, 14, 77,
        ];
        let leaf3 = [
            230, 226, 216, 88, 189, 89, 218, 3, 102, 82, 86, 77, 41, 165, 96, 27, 215, 211, 90,
            183, 70, 50, 241, 8, 75, 144, 199, 135, 169, 158, 252, 89,
        ];
        let leaf4 = [
            244, 18, 69, 111, 89, 21, 224, 175, 106, 216, 219, 195, 82, 29, 140, 143, 29, 190, 238,
            18, 78, 140, 250, 251, 104, 219, 192, 128, 27, 255, 206, 184,
        ];

        let leaves = vec![leaf1, leaf2, leaf3, leaf4];
        let merkle_tree = construct_merkle_tree(leaves.clone());

        return MerkleTreeTestData {
            merkle_tree,
            leaves,
        };
    }

    fn example_merkle_tree2() -> MerkleTreeTestData {
        let leaf1_address = "31HrWnNNM3QvZYNqN2F1CqWE2iiYfCV1pvLvTeZwyHBS";
        let leaf1_amount = 20u64;
        let leaf2_address = "4wcdH4iueQSMGV4JeJGbfM7wD8ZvVfMCQC3RgautKMG1";
        let leaf2_amount = 40u64;
        let leaf3_address = "7N3h2Zp4i9DzRbRGjtJHnRXnUbjKxLpsCnxmz7RLS1qZ";
        let leaf3_amount = 30u64;
        let leaf4_address = "7N3h2Zp4i9DzRbRGjtJHnRXnUbjKxLpsCnxmz7RLS1qZ";
        let leaf4_amount = 30u64;

        let leaf1_bytes = [leaf1_address.as_bytes(), &leaf1_amount.to_le_bytes()].concat();
        let leaf2_bytes = [leaf2_address.as_bytes(), &leaf2_amount.to_le_bytes()].concat();
        let leaf3_bytes = [leaf3_address.as_bytes(), &leaf3_amount.to_le_bytes()].concat();
        let leaf4_bytes = [leaf4_address.as_bytes(), &leaf4_amount.to_le_bytes()].concat();
        let leaves = vec![
            hash(&leaf1_bytes),
            hash(&leaf2_bytes),
            hash(&leaf3_bytes),
            hash(&leaf4_bytes),
        ];
        let merkle_tree = construct_merkle_tree(leaves.clone());

        return MerkleTreeTestData {
            merkle_tree,
            leaves,
        };
    }

    #[test]
    fn test_construct_merkle_tree() {
        let test_data = example_merkle_tree1();
        let merkle_tree = test_data.merkle_tree;
        let leaves = test_data.leaves;

        assert_eq!(merkle_tree.len(), 8);
        assert_eq!(merkle_tree[0], [0u8; 32]);

        assert_eq!(merkle_tree[4], leaves[0]);
        assert_eq!(merkle_tree[5], leaves[1]);
        assert_eq!(merkle_tree[6], leaves[2]);
        assert_eq!(merkle_tree[7], leaves[3]);

        let hash_12 = hash_children(&leaves[0], &leaves[1]);
        let hash_34 = hash_children(&leaves[2], &leaves[3]);
        let hash_12_34 = hash_children(&hash_12, &hash_34);
        assert_eq!(merkle_tree[3], hash_34);
        assert_eq!(merkle_tree[2], hash_12);
        assert_eq!(merkle_tree[1], hash_12_34);
    }

    #[test]
    fn test_create_proof() {
        let test_data = example_merkle_tree1();
        let merkle_tree = test_data.merkle_tree;
        let leaves = test_data.leaves;

        let leaf1_index = leaves.len();
        let leaf2_index = leaves.len() + 1;
        let leaf3_index = leaves.len() + 2;
        let leaf4_index = leaves.len() + 3;

        let proof1 = create_proof(&merkle_tree, leaf1_index);

        assert_eq!(proof1.len(), 2);
        assert_eq!(proof1[0], merkle_tree[leaf2_index]);
        assert_eq!(proof1[1], hash_children(&leaves[2], &leaves[3]));

        let proof2 = create_proof(&merkle_tree, leaf2_index);

        assert_eq!(proof2.len(), 2);
        assert_eq!(proof2[0], merkle_tree[leaf1_index]);
        assert_eq!(proof2[1], hash_children(&leaves[2], &leaves[3]));

        let proof3 = create_proof(&merkle_tree, leaf3_index);

        assert_eq!(proof3.len(), 2);
        assert_eq!(proof3[0], merkle_tree[leaf4_index]);
        assert_eq!(proof3[1], hash_children(&leaves[0], &leaves[1]));

        let proof4 = create_proof(&merkle_tree, leaf4_index);

        assert_eq!(proof4.len(), 2);
        assert_eq!(proof4[0], merkle_tree[leaf3_index]);
        assert_eq!(proof4[1], hash_children(&leaves[0], &leaves[1]));

        let leaf_offset = merkle_tree.len() / 2;

        for i in 0..leaves.len() {
            let mut index = leaf_offset + i;
            let mut hash = merkle_tree[index];
            let proof = create_proof(&merkle_tree, index);

            println!("Proof: {:?}", proof);

            for neighbor_hash in proof {
                if index % 2 == 0 {
                    hash = hash_children(&hash, &neighbor_hash);
                } else {
                    hash = hash_children(&neighbor_hash, &hash);
                }
                index /= 2;
            }
        }
    }

    #[test]
    fn test_merkle_tree_with_address_amount_leaves() {
        // Test using realistic address/amount leaf construction (example_merkle_tree2)
        let test_data = example_merkle_tree2();
        let merkle_tree = test_data.merkle_tree;
        let leaves = test_data.leaves;

        // Verify tree structure
        assert_eq!(merkle_tree.len(), 8); // 4 leaves -> 8 nodes total
        assert_eq!(merkle_tree[0], [0u8; 32]); // Index 0 is unused

        // Verify leaves are placed correctly
        assert_eq!(merkle_tree[4], leaves[0]);
        assert_eq!(merkle_tree[5], leaves[1]);
        assert_eq!(merkle_tree[6], leaves[2]);
        assert_eq!(merkle_tree[7], leaves[3]);

        // Verify intermediate nodes
        let hash_01 = hash_children(&leaves[0], &leaves[1]);
        let hash_23 = hash_children(&leaves[2], &leaves[3]);
        assert_eq!(merkle_tree[2], hash_01);
        assert_eq!(merkle_tree[3], hash_23);

        // Verify root
        let root = hash_children(&hash_01, &hash_23);
        assert_eq!(merkle_tree[1], root);
    }

    #[test]
    fn test_non_full_merkle_tree_3_leaves() {
        // Test with 3 leaves - should pad to 4 leaves
        let leaf1_address = "Address1ForTesting123456789012345";
        let leaf1_amount = 100u64;
        let leaf2_address = "Address2ForTesting123456789012345";
        let leaf2_amount = 200u64;
        let leaf3_address = "Address3ForTesting123456789012345";
        let leaf3_amount = 300u64;

        let leaf1_bytes = [leaf1_address.as_bytes(), &leaf1_amount.to_le_bytes()].concat();
        let leaf2_bytes = [leaf2_address.as_bytes(), &leaf2_amount.to_le_bytes()].concat();
        let leaf3_bytes = [leaf3_address.as_bytes(), &leaf3_amount.to_le_bytes()].concat();

        let leaves = vec![
            hash(&leaf1_bytes),
            hash(&leaf2_bytes),
            hash(&leaf3_bytes),
        ];

        let merkle_tree = construct_merkle_tree(leaves.clone());

        // 3 leaves -> padded to 4 -> tree size is 8
        assert_eq!(merkle_tree.len(), 8);

        // Verify real leaves are in place
        assert_eq!(merkle_tree[4], leaves[0]);
        assert_eq!(merkle_tree[5], leaves[1]);
        assert_eq!(merkle_tree[6], leaves[2]);
        // 4th leaf should be zero-padded
        assert_eq!(merkle_tree[7], [0u8; 32]);

        // Verify intermediate nodes with padding
        let hash_01 = hash_children(&leaves[0], &leaves[1]);
        let hash_2_pad = hash_children(&leaves[2], &[0u8; 32]);
        assert_eq!(merkle_tree[2], hash_01);
        assert_eq!(merkle_tree[3], hash_2_pad);

        // Verify root
        let root = hash_children(&hash_01, &hash_2_pad);
        assert_eq!(merkle_tree[1], root);
    }

    #[test]
    fn test_single_leaf_merkle_tree() {
        // Test with single leaf - tree size is 2 (index 0 unused, index 1 is the leaf/root)
        let address = "SingleAddressForTesting1234567890";
        let amount = 1000u64;

        let leaf_bytes = [address.as_bytes(), &amount.to_le_bytes()].concat();
        let leaf = hash(&leaf_bytes);
        let leaves = vec![leaf];

        let merkle_tree = construct_merkle_tree(leaves.clone());

        // 1 leaf -> min_power_of_2(1)=0 -> tree_levels=1 -> tree size is 2^1 = 2
        assert_eq!(merkle_tree.len(), 2);

        // For single leaf, index 1 holds the leaf itself (it is also the root)
        assert_eq!(merkle_tree[1], leaf);
    }

    #[test]
    fn test_two_leaf_merkle_tree() {
        // Test with 2 leaves - tree size is 4
        let leaf1_address = "Address1ForTesting123456789012345";
        let leaf1_amount = 100u64;
        let leaf2_address = "Address2ForTesting123456789012345";
        let leaf2_amount = 200u64;

        let leaf1_bytes = [leaf1_address.as_bytes(), &leaf1_amount.to_le_bytes()].concat();
        let leaf2_bytes = [leaf2_address.as_bytes(), &leaf2_amount.to_le_bytes()].concat();

        let leaf1 = hash(&leaf1_bytes);
        let leaf2 = hash(&leaf2_bytes);
        let leaves = vec![leaf1, leaf2];

        let merkle_tree = construct_merkle_tree(leaves.clone());

        // 2 leaves -> min_power_of_2(2)=1 -> tree_levels=2 -> tree size is 2^2 = 4
        assert_eq!(merkle_tree.len(), 4);

        // Verify leaf placement
        assert_eq!(merkle_tree[2], leaf1);
        assert_eq!(merkle_tree[3], leaf2);

        // Root is hash of the two leaves
        let expected_root = hash_children(&leaf1, &leaf2);
        assert_eq!(merkle_tree[1], expected_root);
    }

    #[test]
    fn test_proof_verification_end_to_end() {
        // Test that proofs generated from the tree can be verified back to root
        let test_data = example_merkle_tree2();
        let merkle_tree = test_data.merkle_tree;
        let leaves = test_data.leaves;
        let root = merkle_tree[1];
        let leaf_offset = merkle_tree.len() / 2;

        // Verify each leaf's proof leads back to root
        for i in 0..leaves.len() {
            let leaf_index = leaf_offset + i;
            let proof = create_proof(&merkle_tree, leaf_index);

            // Reconstruct root from leaf and proof
            let mut current_hash = leaves[i];
            let mut index = leaf_index;

            for neighbor_hash in proof {
                if index % 2 == 0 {
                    current_hash = hash_children(&current_hash, &neighbor_hash);
                } else {
                    current_hash = hash_children(&neighbor_hash, &current_hash);
                }
                index /= 2;
            }

            assert_eq!(current_hash, root, "Proof verification failed for leaf {}", i);
        }
    }

    #[test]
    fn test_proof_verification_non_full_tree() {
        // Verify proofs work correctly for non-full trees (5 leaves -> padded to 8)
        let addresses = [
            "Addr1TestingPadding12345678901234",
            "Addr2TestingPadding12345678901234",
            "Addr3TestingPadding12345678901234",
            "Addr4TestingPadding12345678901234",
            "Addr5TestingPadding12345678901234",
        ];
        let amounts = [10u64, 20, 30, 40, 50];

        let leaves: Vec<[u8; 32]> = addresses
            .iter()
            .zip(amounts.iter())
            .map(|(addr, amt)| {
                let leaf_bytes = [addr.as_bytes(), &amt.to_le_bytes()].concat();
                hash(&leaf_bytes)
            })
            .collect();

        let merkle_tree = construct_merkle_tree(leaves.clone());

        // 5 leaves -> padded to 8 -> tree size is 16
        assert_eq!(merkle_tree.len(), 16);

        let root = merkle_tree[1];
        let leaf_offset = merkle_tree.len() / 2;

        // Verify each real leaf's proof
        for i in 0..leaves.len() {
            let leaf_index = leaf_offset + i;
            let proof = create_proof(&merkle_tree, leaf_index);

            // Should have 3 levels of proof for 8 leaves
            assert_eq!(proof.len(), 3, "Proof length should be 3 for tree with 8 leaf slots");

            // Reconstruct root from leaf and proof
            let mut current_hash = leaves[i];
            let mut index = leaf_index;

            for neighbor_hash in proof {
                if index % 2 == 0 {
                    current_hash = hash_children(&current_hash, &neighbor_hash);
                } else {
                    current_hash = hash_children(&neighbor_hash, &current_hash);
                }
                index /= 2;
            }

            assert_eq!(current_hash, root, "Proof verification failed for leaf {}", i);
        }
    }

    #[test]
    fn test_invalid_proof_fails_verification() {
        // Ensure that an incorrect amount produces a different leaf hash that won't verify
        let address = "TestAddress1234567890123456789012";
        let correct_amount = 100u64;
        let wrong_amount = 101u64;

        let correct_leaf_bytes = [address.as_bytes(), &correct_amount.to_le_bytes()].concat();
        let wrong_leaf_bytes = [address.as_bytes(), &wrong_amount.to_le_bytes()].concat();

        let correct_leaf = hash(&correct_leaf_bytes);
        let wrong_leaf = hash(&wrong_leaf_bytes);

        // Build tree with correct leaf
        let leaves = vec![correct_leaf];
        let merkle_tree = construct_merkle_tree(leaves);
        let root = merkle_tree[1];
        let leaf_offset = merkle_tree.len() / 2;
        let proof = create_proof(&merkle_tree, leaf_offset);

        // Verify correct leaf works
        let mut current_hash = correct_leaf;
        let mut index = leaf_offset;
        for neighbor_hash in proof.iter() {
            if index % 2 == 0 {
                current_hash = hash_children(&current_hash, neighbor_hash);
            } else {
                current_hash = hash_children(neighbor_hash, &current_hash);
            }
            index /= 2;
        }
        assert_eq!(current_hash, root, "Correct leaf should verify");

        // Verify wrong leaf fails
        let mut current_hash = wrong_leaf;
        let mut index = leaf_offset;
        for neighbor_hash in proof.iter() {
            if index % 2 == 0 {
                current_hash = hash_children(&current_hash, neighbor_hash);
            } else {
                current_hash = hash_children(neighbor_hash, &current_hash);
            }
            index /= 2;
        }
        assert_ne!(current_hash, root, "Wrong leaf should NOT verify to same root");
    }

    #[test]
    fn test_min_power_of_2() {
        assert_eq!(min_power_of_2(1), 0); // 2^0 = 1
        assert_eq!(min_power_of_2(2), 1); // 2^1 = 2
        assert_eq!(min_power_of_2(3), 2); // 2^2 = 4 (next power)
        assert_eq!(min_power_of_2(4), 2); // 2^2 = 4
        assert_eq!(min_power_of_2(5), 3); // 2^3 = 8
        assert_eq!(min_power_of_2(8), 3); // 2^3 = 8
        assert_eq!(min_power_of_2(9), 4); // 2^4 = 16
        assert_eq!(min_power_of_2(100), 7); // 2^7 = 128
    }
}   
