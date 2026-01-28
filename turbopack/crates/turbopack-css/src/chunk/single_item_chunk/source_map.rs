use anyhow::Result;
use turbo_rcstr::rcstr;
use turbo_tasks::{ResolvedVc, Vc};
use turbo_tasks_fs::{File, FileContent, FileSystemPath};
use turbopack_core::{
    asset::{Asset, AssetContent},
    chunk::ChunkingContext,
    output::{OutputAsset, OutputAssetsReference},
    source_map::{GenerateSourceMap, SourceMap},
};

use super::chunk::SingleItemCssChunk;

/// Represents the source map of a single item CSS chunk.
#[turbo_tasks::value]
pub struct SingleItemCssChunkSourceMapAsset {
    chunk: ResolvedVc<SingleItemCssChunk>,
}

#[turbo_tasks::value_impl]
impl SingleItemCssChunkSourceMapAsset {
    #[turbo_tasks::function]
    pub fn new(chunk: ResolvedVc<SingleItemCssChunk>) -> Vc<Self> {
        SingleItemCssChunkSourceMapAsset { chunk }.cell()
    }
}

#[turbo_tasks::value_impl]
impl OutputAssetsReference for SingleItemCssChunkSourceMapAsset {}

#[turbo_tasks::value_impl]
impl OutputAsset for SingleItemCssChunkSourceMapAsset {
    #[turbo_tasks::function]
    async fn path(self: Vc<Self>) -> Result<Vc<FileSystemPath>> {
        let this = self.await?;
        Ok(this
            .chunk
            .await?
            .chunking_context
            .chunk_path(
                Some(Vc::upcast(self)),
                this.chunk.ident_for_path(),
                None,
                rcstr!(".single.css"),
            )
            .await?
            .append(".map")?
            .cell())
    }
}

#[turbo_tasks::value_impl]
impl Asset for SingleItemCssChunkSourceMapAsset {
    #[turbo_tasks::function]
    async fn content(&self) -> Result<Vc<AssetContent>> {
        let content_vc = self.chunk.generate_source_map();
        let content = content_vc.await?;

        if let Some(content_rope) = content.as_content() {
            if let Some(unwrapped) = SourceMap::flatten_index_map(content_rope.content())? {
                return Ok(AssetContent::file(
                    FileContent::Content(File::from(unwrapped)).cell(),
                ));
            }

            return Ok(AssetContent::file(
                FileContent::Content(File::from(content_rope.content().clone())).cell(),
            ));
        }

        Ok(AssetContent::file(
            FileContent::Content(File::from(SourceMap::empty_rope())).cell(),
        ))
    }
}
