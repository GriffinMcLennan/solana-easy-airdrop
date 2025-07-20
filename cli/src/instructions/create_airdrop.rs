use anyhow::{Context, Result};
use csv::StringRecord;
use sha2::{Digest, Sha256};
use std::{fs::File, path::PathBuf};



pub fn create_airdrop(csv_path: &PathBuf) -> Result<()> {
    let (leaves, addresses, amounts) = parse_airdrop_csv(csv_path)?;
    let merkle_tree = construct_merkle_tree(leaves);
    





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
        let leaf_bytes = [address.as_bytes(), amount.as_bytes()].concat();
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
fn write_airdrop_json(tree: &Vec<[u8; 32]>, leaves: &Vec<[u8; 32]>, addresses: &Vec<String>, amounts: &Vec<String>) -> Result<()> {
    let mut file = File::create("airdrop.json").with_context(|| "Failed to create airdrop.json")?;
    let json = serde_json::json!({
        "tree": tree,
        "leaves": leaves,
        "addresses": addresses,
        "amounts": amounts,
    });
    file.write_all(json.to_string().as_bytes()).with_context(|| "Failed to write airdrop.json")?;
    Ok(())
}
fn create_proof(tree: &Vec<[u8; 32]>, leaf_index: usize) -> Vec<[u8; 32]> {
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
        let leaf1 = [232, 15, 182, 90, 199, 3, 132, 189, 139, 171, 3, 88, 214, 11, 124, 190, 150, 222, 91, 45, 231, 192, 149, 224, 216, 105, 88, 82, 233, 198, 115, 175];
        let leaf2 = [220, 96, 196, 202, 71, 96, 102, 23, 158, 19, 147, 24, 168, 148, 204, 170, 123, 211, 7, 49, 137, 228, 248, 5, 149, 5, 128, 79, 0, 135, 14, 77];
        let leaf3 = [230, 226, 216, 88, 189, 89, 218, 3, 102, 82, 86, 77, 41, 165, 96, 27, 215, 211, 90, 183, 70, 50, 241, 8, 75, 144, 199, 135, 169, 158, 252, 89];
        let leaf4 = [244, 18, 69, 111, 89, 21, 224, 175, 106, 216, 219, 195, 82, 29, 140, 143, 29, 190, 238, 18, 78, 140, 250, 251, 104, 219, 192, 128, 27, 255, 206, 184];

        let leaves = vec![leaf1, leaf2, leaf3, leaf4];
        let merkle_tree = construct_merkle_tree(leaves.clone());

        return MerkleTreeTestData { merkle_tree, leaves };
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


        for i in 0..leaves.len() {
            let mut index = leaves.len() + i;
            let mut hash = merkle_tree[index];
            let proof = create_proof(&merkle_tree, index);

            for neighbor_hash in proof {
                if index % 2 == 0 {
                    hash = hash_children(&hash, &neighbor_hash);

                }   
                else {
                    hash = hash_children(&neighbor_hash, &hash);
                } 
                index /= 2;
            }
        }
    }
}